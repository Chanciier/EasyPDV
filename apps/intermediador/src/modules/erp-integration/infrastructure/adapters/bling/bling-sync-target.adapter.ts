import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { SaleSyncPayload, SaleVoidSyncPayload } from "@easypdv/shared-types";
import {
  CLUB_MEMBERSHIP_REPOSITORY,
  type ClubMembershipRepositoryPort,
} from "../../../../club/application/ports/club-membership-repository.port.js";
import { ClubMemberNotFoundError, ClubTipoContatoNotFoundError } from "../../../../club/domain/errors.js";
import type { ClubMemberSummary } from "../../../../club/domain/entities/club-member-summary.js";
import type { SyncTargetInput, SyncTargetPort } from "../../../../sync/application/ports/sync-target.port.js";
import type { ErpProviderCode } from "../../../domain/entities/erp-integration.entity.js";
import { ErpIntegrationNotFoundError, SaleNotSyncedError } from "../../../domain/errors.js";
import {
  ERP_INTEGRATION_REPOSITORY,
  type ErpIntegrationRepositoryPort,
} from "../../../application/ports/erp-integration-repository.port.js";
import {
  ERP_SYNC_MAPPING_REPOSITORY,
  type ErpSyncMappingRepositoryPort,
} from "../../../application/ports/erp-sync-mapping-repository.port.js";
import {
  FISCAL_DOCUMENT_REPOSITORY,
  type FiscalDocumentRepositoryPort,
} from "../../../application/ports/fiscal-document-repository.port.js";
import type { FiscalDocument, FiscalDocumentStatusCode } from "../../../domain/entities/fiscal-document.entity.js";
import { BlingApiClient, BlingApiError } from "../../clients/bling-api.client.js";
import { BlingTokenProviderService } from "../../clients/bling-token-provider.service.js";

const PROVIDER: ErpProviderCode = "bling";
const DEFAULT_CONTACT_NAME = "Consumidor Final";
const DEFAULT_CONTACT_KEY = "default";
const DEFAULT_WAREHOUSE_KEY = "default";

/**
 * Bling rejeita `POST /pedidos/vendas` com um 400 genérico ("Não foi possível
 * salvar a venda") quando a soma de `itens[].valor * quantidade` não fecha com
 * `parcelas[].valor` — achado numa venda REAL com desconto (2026-08-18).
 *
 * O desconto do PDV é sempre no nível da VENDA (`Sale.discountAmount`, nunca
 * por item — ver docs/DATABASE.md), então `SaleSyncPayloadItem.unitPrice`
 * chega aqui com o preço CHEIO. A primeira tentativa de corrigir isso foi
 * ratear o desconto nos preços unitários — e uma verificação da própria
 * matemática (antes de subir!) provou que **isso é impossível de fechar em
 * geral**: com `quantidade > 1`, um preço unitário de 2 casas só consegue
 * expressar totais múltiplos da quantidade (ex.: total R$20,00 com 3 unidades
 * → 6,67×3 = 20,01 ou 6,66×3 = 19,98, nunca 20,00). Rateio foi descartado.
 *
 * A forma correta é a que o próprio Bling oferece: itens com o preço REAL
 * (importa pro relatório/NF-e do lojista) + `desconto` no nível do pedido
 * (`{ valor, unidade: "REAL" }`, confirmado contra a interface pública da
 * API v3). Fecha exato, sem arredondamento, e o desconto aparece como
 * desconto no Bling em vez de sumir dentro do preço do produto.
 *
 * Derivado dos itens (subtotal − total) em vez de vir no payload: mantém
 * compatibilidade com `SyncJob`s já gravados antes desta correção, que não
 * têm `discountAmount` nenhum — o job travado da venda real é justamente um
 * desses.
 */
/**
 * Método de pagamento do PDV → `tipoPagamento` do Bling, em ordem de
 * preferência (o primeiro que existir na conta do lojista vence). Códigos
 * documentados na API v3: 1 Dinheiro, 3 Cartão de Crédito, 4 Cartão de
 * Débito, 17 PIX dinâmico, 20 PIX estático, 99 Outros.
 */
const PREFERRED_TIPO_PAGAMENTO: Record<string, number[]> = {
  dinheiro: [1],
  pix: [17, 20],
  cartao_credito: [3],
  cartao_debito: [4],
  // "cartao" sem detalhe: crédito é o caso mais comum no balcão.
  cartao: [3, 4],
  // 21 confirmado empiricamente contra a conta real do usuário (2026-08-21,
  // GET /formas-pagamentos): é o mesmo tipoPagamento genérico usado por
  // "Crediário" — Bling não documenta um código dedicado pra vale-troca.
  // Só um fallback (o nome exato "Vale-Troca" já resolve certo antes disso
  // rodar, ver expectedBlingDescricao) — numa conta sem essa forma cadastrada
  // com esse nome exato, pode escolher errado se houver mais de uma forma
  // com tipoPagamento 21.
  vale_troca: [21],
  outro: [99],
};

/**
 * Bandeira do cartão (2026-08-21) — Bling não tem campo estruturado pra
 * bandeira: "Crédito (Mastercard)" e "Crédito (Visa)" são só NOMES diferentes
 * de forma de pagamento com o MESMO tipoPagamento (3) — impossível distinguir
 * só pelo tipo. Nomes exatos confirmados contra a conta Bling real do usuário
 * (GET /formas-pagamentos, 2026-08-21): "Dinheiro", "Pix", "Vale-Troca",
 * "Crédito (Mastercard)", "Crédito (Visa)", "Débito (Mastercard)", "Débito
 * (Visa)". Se o lojista renomear essas formas no painel, o nome exato para de
 * bater e cai pro fallback por tipoPagamento (menos preciso, mas não trava a
 * venda) — ver resolvePaymentMethodFromAccount.
 */
function expectedBlingDescricao(method: string, cardType?: string | null, cardBrand?: string | null): string | null {
  if (method === "dinheiro") return "Dinheiro";
  if (method === "pix") return "Pix";
  if (method === "vale_troca") return "Vale-Troca";
  if (method === "cartao" && cardType && cardBrand) {
    const tipo = cardType === "credito" ? "Crédito" : cardType === "debito" ? "Débito" : null;
    const bandeira = cardBrand === "mastercard" ? "Mastercard" : cardBrand === "visa" ? "Visa" : null;
    if (tipo && bandeira) return `${tipo} (${bandeira})`;
  }
  return null;
}

function computeOrderDiscount(items: { quantidade: number; valor: number }[], totalAmount: number): number {
  const subtotal = items.reduce((sum, item) => sum + item.valor * item.quantidade, 0);
  const discount = Math.round((subtotal - totalAmount) * 100) / 100;
  return discount > 0 ? discount : 0;
}

/**
 * 1 Pendente, 3 Aguardando recibo, 7 Registrada, 8 Aguardando protocolo,
 * 10 Consulta situação → pending (ainda sem veredito da SEFAZ).
 * 5 Autorizada, 6 Emitida DANFE → issued.
 * 2 Cancelada → cancelled.
 * 4 Rejeitada, 9 Denegada, 11 Bloqueada → error (falha de verdade, não só
 * "ainda processando" — precisa de atenção do lojista, não é transitório).
 * Ver bling-erp-api-js `ISituacaoNfce`, confirmado na pesquisa da Sprint 12.
 */
function mapSituacaoToStatus(situacao: number | null): FiscalDocumentStatusCode {
  if (situacao === null) return "pending";
  if (situacao === 5 || situacao === 6) return "issued";
  if (situacao === 2) return "cancelled";
  if (situacao === 4 || situacao === 9 || situacao === 11) return "error";
  return "pending";
}

/**
 * Implementa a mesma SyncTargetPort do NoopSyncTargetAdapter (Sprint 6) —
 * substituição transparente, sem tocar no SyncProcessor nem nos use-cases.
 * Só sabe processar entityType="sale" por enquanto. Além de criar o pedido de
 * venda, também baixa o estoque vendido no Bling (`pushStockMovements`,
 * 2026-08-19) — a metade PDV→Bling do sync bidirecional de estoque; a
 * metade Bling→PDV é o poll incremental em `SyncProductsFromBlingUseCase`
 * (pdv-backend). V1 simplificação single-tenant: resolve "a" integração
 * ativa em vez de rotear por loja (Sprint 10 resolve isso de verdade).
 * Contato usa um valor padrão fixo ("Consumidor Final", resolvido/criado e
 * cacheado via ErpSyncMapping). Forma de pagamento vem de config — Bling não
 * expõe endpoint de listagem, os ids só existem no painel do Bling
 * (Configurações > Formas de Pagamento), confirmado contra a API real na
 * Sprint 7. Até a Sprint 14 era um único id fixo (BLING_DEFAULT_PAYMENT_METHOD_ID)
 * pra TODO pedido, ignorando a forma de pagamento real da venda — corrigido
 * com um mapa opcional por método (BLING_PAYMENT_METHOD_ID_MAP), caindo pro
 * id fixo quando a venda usa um método sem entrada no mapa. V1 não faz split
 * de pagamento (a tela de Venda sempre registra um Payment só, cobrindo o
 * total) — resolvePaymentMethodId usa o primeiro payments[] do payload.
 *
 * Pedido de venda é resolvido de forma idempotente via ErpSyncMapping
 * (checa ANTES de criar, Sprint 12) — necessário porque `createSalesOrder`
 * não é idempotente do lado do Bling: sem essa checagem, um retry do
 * SyncJob depois do pedido já ter sido criado (ex: falha na emissão fiscal
 * logo em seguida) criaria um pedido duplicado.
 */
@Injectable()
export class BlingSyncTargetAdapter implements SyncTargetPort {
  private readonly logger = new Logger(BlingSyncTargetAdapter.name);

  constructor(
    @Inject(ERP_INTEGRATION_REPOSITORY) private readonly erpIntegrationRepository: ErpIntegrationRepositoryPort,
    @Inject(ERP_SYNC_MAPPING_REPOSITORY) private readonly erpSyncMappingRepository: ErpSyncMappingRepositoryPort,
    @Inject(FISCAL_DOCUMENT_REPOSITORY) private readonly fiscalDocumentRepository: FiscalDocumentRepositoryPort,
    @Inject(CLUB_MEMBERSHIP_REPOSITORY) private readonly clubMembershipRepository: ClubMembershipRepositoryPort,
    private readonly tokenProvider: BlingTokenProviderService,
    private readonly blingApiClient: BlingApiClient,
    private readonly configService: ConfigService,
  ) {}

  async process(input: SyncTargetInput): Promise<void> {
    if (input.entityType === "sale_void") {
      await this.processVoid(input);
      return;
    }
    if (input.entityType !== "sale") {
      this.logger.warn(`entityType "${input.entityType}" ainda não suportado pelo Adapter Bling — ignorando.`);
      return;
    }

    const integration = await this.erpIntegrationRepository.findFirstActive(PROVIDER);
    if (!integration) {
      throw new ErpIntegrationNotFoundError("(nenhuma organização com Bling conectado)");
    }

    const accessToken = await this.tokenProvider.getValidAccessToken(integration);
    const payload = input.payload as SaleSyncPayload;
    const organizationId = integration.organizationId;

    const orderExternalId = await this.resolveSalesOrder(accessToken, organizationId, payload);

    // Baixa de estoque é caminho crítico (ao contrário da NFC-e, que é
    // "best effort" — ver ensureFiscalDocument): sem isso, o estoque do Bling
    // fica desatualizado até o próximo poll incremental notar a divergência,
    // e como o poll só reage a mudanças DO LADO do Bling, uma venda cujo push
    // falhou nunca se autocorrige sozinha. Deixa o erro propagar de propósito
    // — o SyncProcessor marca o SyncJob como failed e retenta, mesma
    // semântica de resolveSalesOrder.
    await this.pushStockMovements(accessToken, organizationId, payload);

    // CPF no início da venda (2026-08-25) — reverte a decisão anterior de
    // NFC-e sempre emitida: agora só emite NFC-e de verdade (SEFAZ) quando o
    // cliente informou CPF. Sem CPF, grava um comprovante NÃO fiscal local
    // (recordNonFiscalReceipt), sem nenhuma chamada ao Bling/SEFAZ. Decisão
    // deliberada e confirmada com o usuário depois de eu levantar o risco
    // fiscal explicitamente — ver Planejamento - Clube Saldão.md seção 5.1
    // no cofre Obsidian. BLING_NFCE_AUTO_EMIT continua valendo como trava de
    // conta (AND, não substituída) — desliga a emissão real mesmo com CPF
    // se a conta ainda não estiver pronta pra fiscal de verdade.
    if (this.isNfceAutoEmitEnabled() && payload.customerDocument) {
      await this.ensureFiscalDocument(accessToken, organizationId, payload.saleId, orderExternalId);
    } else if (!payload.customerDocument) {
      await this.recordNonFiscalReceipt(organizationId, payload.saleId);
    }

    // Depois da NFC-e de propósito (2026-08-19): sem confirmação de que
    // gerar-nfce funciona contra um pedido já "Atendido", e o caminho de
    // NFC-e já é testado/estável — não vale arriscar quebrá-lo pela
    // situação nova. Testado contra a conta real: essa transição não baixa
    // estoque sozinha nesta conta (nenhuma duplicação da baixa explícita
    // acima) — ver `advanceSalesOrderToAtendido`.
    await this.advanceSalesOrderToAtendido(accessToken, organizationId, payload.saleId, orderExternalId);
  }

  /**
   * Baixa no Bling o estoque vendido no PDV (`operacao: "S"`, um `POST
   * /estoques` por item). Decisão (2026-08-19, pedido do usuário: "o bling
   * tem que andar junto com o estoque do intermediador") de usar a API de
   * estoque explícita em vez de avançar a `situação` do pedido de venda —
   * ver comentário de `BlingApiClient.createStockMovement`. Idempotente via
   * ErpSyncMapping própria (localEntityType "sale_stock"), independente da
   * marca de `resolveSalesOrder`: um retry de SyncJob pode acontecer depois
   * do pedido já ter sido criado mas antes da baixa de estoque (ou vice-versa
   * numa falha parcial), então as duas idempotências precisam ser
   * verificadas/gravadas separadamente.
   */
  private async pushStockMovements(accessToken: string, organizationId: string, payload: SaleSyncPayload): Promise<void> {
    const alreadyPushed = await this.erpSyncMappingRepository.find(organizationId, PROVIDER, "sale_stock", payload.saleId);
    if (alreadyPushed) {
      return;
    }

    const depositoId = await this.resolveWarehouseId(accessToken, organizationId);

    for (const item of payload.items) {
      const produtoId = await this.resolveProduct(accessToken, organizationId, item.sku, item.name);
      await this.blingApiClient.createStockMovement(accessToken, {
        produtoId,
        depositoId,
        operacao: "S",
        quantidade: item.quantity,
        observacoes: `Venda PDV ${payload.saleId}`,
      });
    }

    await this.erpSyncMappingRepository.upsert({
      organizationId,
      provider: PROVIDER,
      localEntityType: "sale_stock",
      localEntityId: payload.saleId,
      externalId: "ok",
    });

    this.logger.log(`Estoque baixado no Bling: sale=${payload.saleId} deposito=${depositoId} itens=${payload.items.length}`);
  }

  /**
   * Avança o pedido de venda de "Em aberto" pra "Atendido" (2026-08-19,
   * pedido do usuário). Confirmado contra a conta real do usuário antes de
   * automatizar: `PATCH /pedidos/vendas/{id}/situacoes/{idSituacao}` (não
   * `PUT` — testado, `PUT` devolve 404) não baixa estoque sozinho nesta
   * conta (comparado antes/depois via `GET /produtos/{id}`, saldo idêntico)
   * — não duplica a baixa explícita de `pushStockMovements`. Deliberadamente
   * não avança situação no estorno (`processVoid`) — risco de duplicar
   * ESTORNO de estoque é mais direto ali, ver comentário de `processVoid`.
   *
   * **Achado numa venda real (2026-08-20)**: nem todo pedido nasce "Em
   * aberto" — um pedido com contato por CPF + pagamento à vista já veio
   * criado direto em "Atendido" nesta conta (Bling recusou o PATCH com
   * `code: 50` "A venda possui a mesma situação", não um erro de verdade).
   * Sem tratar isso, o `SyncJob` inteiro ficava preso em retry eterno — o
   * `code: 50` agora é tratado como sucesso (o objetivo, "estar em
   * Atendido", já foi alcançado por outro caminho).
   */
  private async advanceSalesOrderToAtendido(
    accessToken: string,
    organizationId: string,
    saleId: string,
    orderExternalId: string,
  ): Promise<void> {
    const alreadyAdvanced = await this.erpSyncMappingRepository.find(organizationId, PROVIDER, "sale_situacao", saleId);
    if (alreadyAdvanced) {
      return;
    }

    const situacaoId = await this.resolveAtendidoSituacaoId(accessToken, organizationId);
    try {
      await this.blingApiClient.updateSalesOrderSituacao(accessToken, Number(orderExternalId), situacaoId);
    } catch (error) {
      if (error instanceof BlingApiError && error.hasFieldCode(50)) {
        this.logger.log(`Pedido de venda ${orderExternalId} já estava em "Atendido" — nada a fazer.`);
      } else {
        throw error;
      }
    }

    await this.erpSyncMappingRepository.upsert({
      organizationId,
      provider: PROVIDER,
      localEntityType: "sale_situacao",
      localEntityId: saleId,
      externalId: "ok",
    });
    this.logger.log(`Pedido de venda avançado pra "Atendido" no Bling: local=${saleId} bling=${orderExternalId}`);
  }

  /**
   * Resolve o id da situação "Atendido" pro módulo de Pedidos de Venda —
   * NUNCA hardcoded: o id é específico da conta (confirmado real: "Em
   * aberto"=6, "Atendido"=9 na conta do usuário, sem garantia documentada de
   * valer pra outra conta), só o id do MÓDULO "Vendas" (98310) é fixo.
   */
  private async resolveAtendidoSituacaoId(accessToken: string, organizationId: string): Promise<number> {
    const cached = await this.erpSyncMappingRepository.find(organizationId, PROVIDER, "order_situacao", "atendido");
    if (cached) {
      return Number(cached.externalId);
    }

    const situacoes = await this.blingApiClient.listSalesOrderSituacoes(accessToken);
    const atendido = situacoes.find((s) => s.nome === "Atendido");
    if (!atendido) {
      throw new Error('Conta Bling não tem situação "Atendido" cadastrada pro módulo de Pedidos de Venda.');
    }

    await this.erpSyncMappingRepository.upsert({
      organizationId,
      provider: PROVIDER,
      localEntityType: "order_situacao",
      localEntityId: "atendido",
      externalId: String(atendido.id),
    });
    return atendido.id;
  }

  /**
   * Resolve o id do tipo de contato "Clube Saldão" nesta conta — NUNCA
   * hardcoded (é específico da conta, mesmo padrão de `resolveAtendidoSituacaoId`
   * acima). Confirmado ao vivo, 2026-08-25: id `14584712737` só nesta conta.
   */
  private async resolveClubTipoContatoId(accessToken: string, organizationId: string): Promise<number> {
    const cached = await this.erpSyncMappingRepository.find(organizationId, PROVIDER, "contact_type", "clube_saldao");
    if (cached) {
      return Number(cached.externalId);
    }

    const tipos = await this.blingApiClient.listContactTypes(accessToken);
    const clube = tipos.find((t) => t.descricao === "Clube Saldão");
    if (!clube) {
      throw new ClubTipoContatoNotFoundError();
    }

    await this.erpSyncMappingRepository.upsert({
      organizationId,
      provider: PROVIDER,
      localEntityType: "contact_type",
      localEntityId: "clube_saldao",
      externalId: String(clube.id),
    });
    return clube.id;
  }

  /**
   * Checagem usada na hora da venda (chamador trata falha como "fail-open",
   * nunca bloqueia a venda) — só lê o cache local (`ClubMembership`), nunca
   * chama o Bling: o cache já é a fonte da verdade de validade, e o rate
   * limit do Bling (3 req/s) não combina com "checar em toda venda com CPF".
   */
  async checkClubMembership(organizationId: string, document: string): Promise<boolean> {
    const membership = await this.clubMembershipRepository.findByCpf(organizationId, PROVIDER, document);
    return !!membership && membership.isValid;
  }

  /**
   * Lista ao vivo do Bling (fonte da verdade de "é do clube", requisito do
   * usuário — "só serão exibidos como clube aqueles que estão com esse tipo
   * de contato") — sem cache local pra listagem em si, só junta a validade
   * (`ClubMembership`) por CPF depois de ler os contatos.
   */
  async listClubMembers(organizationId: string): Promise<ClubMemberSummary[]> {
    const integration = await this.erpIntegrationRepository.findFirstActive(PROVIDER);
    if (!integration) {
      throw new ErpIntegrationNotFoundError(organizationId);
    }
    const accessToken = await this.tokenProvider.getValidAccessToken(integration);
    const clubTipoId = await this.resolveClubTipoContatoId(accessToken, organizationId);
    const contacts = await this.blingApiClient.listContactsByTipo(accessToken, clubTipoId);

    const summaries: ClubMemberSummary[] = [];
    for (const contact of contacts) {
      if (!contact.numeroDocumento) continue; // clube exige CPF - contato sem documento não é rastreável aqui
      const membership = await this.clubMembershipRepository.findByCpf(organizationId, PROVIDER, contact.numeroDocumento);
      summaries.push({
        document: contact.numeroDocumento,
        name: contact.nome,
        validUntil: membership ? membership.validUntil.toISOString() : null,
      });
    }
    return summaries;
  }

  /**
   * Adiciona alguém ao clube: reaproveita `resolveContactByCpf` (mesmo cache
   * por CPF do fluxo "CPF na nota", evita duplicar contato/corrida — ver
   * docblock daquele método) pra achar ou criar o contato, depois sempre
   * atualiza o nome pro informado e mescla a tag "Clube Saldão" em cima do
   * `tiposContato` atual (nunca sobrescreve outros tipos que já tinha).
   * `phone` (2026-09-02) vai pro campo `celular` do contato no Bling —
   * confirmado no schema oficial da API v3, campo top-level distinto de
   * `telefone` (fixo).
   */
  async addClubMember(
    organizationId: string,
    name: string,
    document: string,
    validUntil: Date,
    phone: string,
  ): Promise<ClubMemberSummary> {
    const integration = await this.erpIntegrationRepository.findFirstActive(PROVIDER);
    if (!integration) {
      throw new ErpIntegrationNotFoundError(organizationId);
    }
    const accessToken = await this.tokenProvider.getValidAccessToken(integration);
    const clubTipoId = await this.resolveClubTipoContatoId(accessToken, organizationId);
    const contactId = await this.resolveContactByCpf(accessToken, organizationId, document, name);

    const contact = await this.blingApiClient.getContactById(accessToken, contactId);
    const currentTipoIds = (contact.tiposContato ?? []).map((t) => ({ id: t.id }));
    const hasClubTag = currentTipoIds.some((t) => t.id === clubTipoId);
    await this.blingApiClient.updateContact(accessToken, contactId, {
      nome: name,
      tipo: contact.tipo ?? "F",
      tiposContato: hasClubTag ? currentTipoIds : [...currentTipoIds, { id: clubTipoId }],
      numeroDocumento: document,
      celular: phone,
    });

    const membership = await this.clubMembershipRepository.upsert({
      organizationId,
      provider: PROVIDER,
      customerCpf: document,
      validUntil,
    });
    return { document, name, validUntil: membership.validUntil.toISOString() };
  }

  /**
   * Remove do clube: tira só a tag "Clube Saldão" de `tiposContato` (mantém
   * as demais que o contato tiver) e apaga a linha local de validade. É o
   * único caminho pra cancelar OU renovar (validade não é editável — ver
   * "Planejamento - Clube Saldão.md" seção 5.4/5.5 no cofre Obsidian).
   */
  async removeClubMember(organizationId: string, document: string): Promise<void> {
    const integration = await this.erpIntegrationRepository.findFirstActive(PROVIDER);
    if (!integration) {
      throw new ErpIntegrationNotFoundError(organizationId);
    }
    const accessToken = await this.tokenProvider.getValidAccessToken(integration);
    const clubTipoId = await this.resolveClubTipoContatoId(accessToken, organizationId);
    const contact = await this.blingApiClient.findContactByDocument(accessToken, document);
    if (!contact) {
      throw new ClubMemberNotFoundError(document);
    }

    const full = await this.blingApiClient.getContactById(accessToken, contact.id);
    const remainingTipoIds = (full.tiposContato ?? []).filter((t) => t.id !== clubTipoId).map((t) => ({ id: t.id }));
    await this.blingApiClient.updateContact(accessToken, contact.id, {
      nome: full.nome,
      tipo: full.tipo ?? "F",
      tiposContato: remainingTipoIds,
      numeroDocumento: document,
    });

    await this.clubMembershipRepository.delete(organizationId, PROVIDER, document);
  }

  /**
   * Estorno de venda confirmada (2026-08-19) — repõe no Bling o estoque que
   * `pushStockMovements` baixou, senão o poll incremental Bling→PDV (fonte
   * da verdade = Bling) reverte silenciosamente a devolução de estoque que o
   * `voidConfirmed` já fez localmente assim que rodar de novo. Não tenta
   * mudar a `situação` do pedido de venda pra "Cancelado" — a conta Bling
   * pode ter "Estornar estoque" ligado nessa transição (Gerenciador de
   * transições), o que dobraria a devolução de estoque feita aqui via
   * `POST /estoques`; cancelar o pedido no painel do Bling continua manual
   * por ora (mesma decisão de manter estoque só pela API explícita, ver
   * `pushStockMovements`).
   */
  private async processVoid(input: SyncTargetInput): Promise<void> {
    const integration = await this.erpIntegrationRepository.findFirstActive(PROVIDER);
    if (!integration) {
      throw new ErpIntegrationNotFoundError("(nenhuma organização com Bling conectado)");
    }
    const accessToken = await this.tokenProvider.getValidAccessToken(integration);
    const payload = input.payload as SaleVoidSyncPayload;
    await this.pushVoidStockMovements(accessToken, integration.organizationId, payload);
  }

  /**
   * Só repõe estoque se a baixa original (`pushStockMovements`, marca
   * "sale_stock") realmente aconteceu — uma venda estornada antes do
   * SyncOutbox alcançar o Bling nunca baixou nada lá, então não há o que
   * devolver (repor às cegas infla o estoque indevidamente).
   */
  private async pushVoidStockMovements(accessToken: string, organizationId: string, payload: SaleVoidSyncPayload): Promise<void> {
    const originalPush = await this.erpSyncMappingRepository.find(organizationId, PROVIDER, "sale_stock", payload.saleId);
    if (!originalPush) {
      this.logger.log(`Estorno ${payload.saleId}: baixa original nunca chegou no Bling — nada a repor.`);
      return;
    }

    const alreadyReverted = await this.erpSyncMappingRepository.find(organizationId, PROVIDER, "sale_void_stock", payload.saleId);
    if (alreadyReverted) {
      return;
    }

    const depositoId = await this.resolveWarehouseId(accessToken, organizationId);

    for (const item of payload.items) {
      const produtoId = await this.resolveProduct(accessToken, organizationId, item.sku, item.name);
      await this.blingApiClient.createStockMovement(accessToken, {
        produtoId,
        depositoId,
        operacao: "E",
        quantidade: item.quantity,
        observacoes: `Estorno de venda PDV ${payload.saleId}`,
      });
    }

    await this.erpSyncMappingRepository.upsert({
      organizationId,
      provider: PROVIDER,
      localEntityType: "sale_void_stock",
      localEntityId: payload.saleId,
      externalId: "ok",
    });

    this.logger.log(`Estoque reposto no Bling (estorno): sale=${payload.saleId} deposito=${depositoId} itens=${payload.items.length}`);
  }

  /**
   * Resolve o depósito da conta Bling pra usar em `POST /estoques` — cache
   * (ErpSyncMapping) → `GET /depositos` (prefere `padrao: true`, senão o
   * primeiro ativo, senão o primeiro que vier) → falha explícita se a conta
   * não tiver nenhum depósito (não deveria acontecer: toda conta Bling nasce
   * com um depósito padrão).
   */
  private async resolveWarehouseId(accessToken: string, organizationId: string): Promise<number> {
    const cached = await this.erpSyncMappingRepository.find(organizationId, PROVIDER, "warehouse", DEFAULT_WAREHOUSE_KEY);
    if (cached) {
      return Number(cached.externalId);
    }

    const warehouses = await this.blingApiClient.listWarehouses(accessToken);
    if (warehouses.length === 0) {
      throw new Error("Conta Bling não tem nenhum depósito cadastrado — não é possível baixar estoque.");
    }
    const active = warehouses.filter((w) => w.situacao === undefined || w.situacao === "A");
    const pool = active.length > 0 ? active : warehouses;
    // `pool` nunca é vazio aqui (deriva de `warehouses`, já checado acima) —
    // `?? pool[0]` é só pra satisfazer `noUncheckedIndexedAccess`.
    const resolved = pool.find((w) => w.padrao)?.id ?? pool[0]?.id;
    if (resolved === undefined) {
      throw new Error("Conta Bling não tem nenhum depósito cadastrado — não é possível baixar estoque.");
    }

    await this.erpSyncMappingRepository.upsert({
      organizationId,
      provider: PROVIDER,
      localEntityType: "warehouse",
      localEntityId: DEFAULT_WAREHOUSE_KEY,
      externalId: String(resolved),
    });
    this.logger.log(`Depósito Bling resolvido pra baixa de estoque: id=${resolved}`);
    return resolved;
  }

  private async resolveSalesOrder(
    accessToken: string,
    organizationId: string,
    payload: SaleSyncPayload,
  ): Promise<string> {
    const cached = await this.erpSyncMappingRepository.find(organizationId, PROVIDER, "sale", payload.saleId);
    if (cached) {
      return cached.externalId;
    }

    const contatoId = payload.customerDocument
      ? await this.resolveContactByCpf(accessToken, organizationId, payload.customerDocument, payload.customerName)
      : await this.resolveDefaultContact(accessToken, organizationId);

    // Pagamento dividido (2026-08-21) — uma parcela por perna de pagamento,
    // cada uma com sua própria forma de pagamento resolvida na conta Bling
    // (antes só usava payload.payments[0], ignorando o resto). Sem nenhuma
    // perna (payload antigo/incompleto), cai num pagamento "outro" cobrindo
    // o total — mesmo fallback de sempre.
    const paymentsToResolve = payload.payments?.length
      ? payload.payments
      : [{ method: "outro" as const, amount: payload.totalAmount, cardType: null, cardBrand: null }];
    const parcelas = [];
    for (const payment of paymentsToResolve) {
      const formaPagamentoId = await this.resolvePaymentMethodId(
        accessToken,
        organizationId,
        payment.method,
        payment.cardType,
        payment.cardBrand,
      );
      parcelas.push({ valor: payment.amount, formaPagamentoId });
    }

    const items = [];
    for (const item of payload.items) {
      const produtoId = await this.resolveProduct(accessToken, organizationId, item.sku, item.name);
      items.push({ produtoId, quantidade: item.quantity, valor: item.unitPrice, descricao: item.name || item.sku });
    }

    const dueDate = payload.confirmedAt.slice(0, 10);
    const result = await this.blingApiClient.createSalesOrder(accessToken, {
      contatoId,
      parcelas,
      totalAmount: payload.totalAmount,
      discountAmount: computeOrderDiscount(items, payload.totalAmount),
      dueDate,
      items,
      saleId: payload.saleId,
    });

    await this.erpSyncMappingRepository.upsert({
      organizationId,
      provider: PROVIDER,
      localEntityType: "sale",
      localEntityId: payload.saleId,
      externalId: result.externalId,
    });

    this.logger.log(`Pedido de venda criado no Bling: local=${payload.saleId} bling=${result.externalId}`);
    return result.externalId;
  }

  /**
   * Gera + transmite a NFC-e a partir do pedido de venda já resolvido.
   * Idempotente via FiscalDocument (um por saleId): se já existe um
   * documento "pending" (rascunho gerado mas não enviado, ex: falha de rede
   * na etapa de envio numa tentativa anterior), reaproveita o mesmo
   * `externalId` em vez de gerar outra NFC-e. Falha aqui NUNCA propaga pra
   * fora (nunca marca o SyncJob como failed) — o pedido de venda já foi
   * criado com sucesso, e "fiscal pode esperar" é decisão já registrada em
   * Decisões e Riscos Abertos; erro fica visível via GET /fiscal/sale/:id,
   * sem retry automático nesta sprint.
   */
  /**
   * Reconsulta a NFC-e no Bling quando o status local ainda está "pending",
   * OU quando já está "issued" mas sem `qrCodeUrl` (documento incompleto —
   * ver bug do link de XML corrigido em `BlingApiClient.fetchQrCodeUrl`,
   * 2026-08-25: notas emitidas ANTES dessa correção ficaram "issued" pra
   * sempre com qrCodeUrl null, porque `ensureFiscalDocument` só roda uma vez
   * por venda; sem reconsultar essas também, ficariam travadas mesmo com o
   * bug de extração já corrigido). `ensureFiscalDocument` só checa UMA vez,
   * logo depois de `sendNfce` (fire-and-forget: transmite pra SEFAZ mas não
   * espera a autorização sair). Sem isso, `GET /fiscal/sale/:saleId`
   * (consultado pelo PDV em polling, ver GetFiscalStatusUseCase) ficava
   * devolvendo pra sempre o mesmo status desatualizado/incompleto — bug real
   * de produção (2026-08-25): "nota autorizada, porém não impressa" (o guard
   * do PDV exige documentNumber+accessKey+qrCodeUrl todos presentes antes de
   * imprimir). "error"/"cancelled" nunca reconsulta — já é final. Falha aqui
   * nunca propaga: pior caso é continuar mostrando o status antigo até a
   * próxima tentativa.
   */
  async refreshFiscalStatus(saleId: string): Promise<FiscalDocument | null> {
    const doc = await this.fiscalDocumentRepository.findBySale(saleId);
    const needsRefresh = doc && (doc.status === "pending" || (doc.status === "issued" && !doc.qrCodeUrl));
    if (!doc || !needsRefresh) {
      return doc;
    }

    try {
      const integration = await this.erpIntegrationRepository.findFirstActive(PROVIDER);
      if (!integration) {
        return doc;
      }
      const accessToken = await this.tokenProvider.getValidAccessToken(integration);
      const details = await this.blingApiClient.findNfce(accessToken, Number(doc.externalId));
      await this.updateFiscalDocumentFromBling(doc, details);
      return this.fiscalDocumentRepository.findBySale(saleId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Não foi possível reconsultar status da NFC-e (venda ${saleId}) no Bling: ${message}`);
      return doc;
    }
  }

  /**
   * Emissão manual de NFC-e (Histórico, 2026-08-26) pra venda que foi
   * confirmada SEM CPF — por padrão essas vendas só geram um comprovante
   * local (`recordNonFiscalReceipt`), sem chamada nenhuma ao Bling/SEFAZ.
   * Pedido explícito do operador: às vezes o cliente quer a nota fiscal
   * mesmo sem informar CPF (NFC-e pra "Consumidor Final" é normal e válida
   * no Brasil — CPF nela é sempre opcional). O pedido de venda já existe no
   * Bling (criado por `resolveSalesOrder` de qualquer forma, independente de
   * CPF) — só falta a etapa de gerar+enviar a NFC-e em cima dele.
   *
   * Reaproveita `ensureFiscalDocument` (mesmo código do caminho automático),
   * mas ela só cria um documento novo quando `findBySale` não acha nada — o
   * comprovante não fiscal já ocupa essa vaga (mesma unique constraint
   * `[organizationId, provider, saleId]`), então precisa sumir primeiro.
   * Se já existir uma NFC-e de verdade (emissão manual chamada duas vezes,
   * ou uma corrida com o fluxo automático), não mexe em nada — devolve a
   * que já existe.
   */
  async issueFiscalReceiptManually(organizationId: string, saleId: string): Promise<FiscalDocument> {
    const integration = await this.erpIntegrationRepository.findFirstActive(PROVIDER);
    if (!integration) {
      throw new ErpIntegrationNotFoundError(organizationId);
    }

    const mapping = await this.erpSyncMappingRepository.find(organizationId, PROVIDER, "sale", saleId);
    if (!mapping) {
      throw new SaleNotSyncedError(saleId);
    }

    const existing = await this.fiscalDocumentRepository.findBySale(saleId);
    if (existing && existing.type !== "comprovante_nao_fiscal") {
      return existing;
    }
    if (existing) {
      await this.fiscalDocumentRepository.delete(existing.id);
    }

    const accessToken = await this.tokenProvider.getValidAccessToken(integration);
    await this.ensureFiscalDocument(accessToken, organizationId, saleId, mapping.externalId);

    const doc = await this.fiscalDocumentRepository.findBySale(saleId);
    if (!doc) {
      throw new Error(`ensureFiscalDocument não criou um FiscalDocument pra venda ${saleId}`);
    }
    return doc;
  }

  private async ensureFiscalDocument(
    accessToken: string,
    organizationId: string,
    saleId: string,
    orderExternalId: string,
  ): Promise<void> {
    try {
      let doc = await this.fiscalDocumentRepository.findBySale(saleId);
      if (!doc) {
        const { nfceId } = await this.blingApiClient.generateNfceFromOrder(accessToken, Number(orderExternalId));
        doc = await this.fiscalDocumentRepository.create({
          organizationId,
          provider: PROVIDER,
          saleId,
          externalId: String(nfceId),
        });
        this.logger.log(`NFC-e gerada (rascunho) no Bling: local=${saleId} nfce=${nfceId}`);
      }

      if (doc.status === "pending" && doc.externalStatus === null) {
        await this.blingApiClient.sendNfce(accessToken, Number(doc.externalId));
      }

      const details = await this.blingApiClient.findNfce(accessToken, Number(doc.externalId));
      await this.updateFiscalDocumentFromBling(doc, details);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Falha ao emitir NFC-e pra venda ${saleId}: ${message}`);
      const existing = await this.fiscalDocumentRepository.findBySale(saleId);
      if (existing) {
        await this.fiscalDocumentRepository.update(existing.id, { status: "error", errorMessage: message });
      }
    }
  }

  /**
   * Venda sem CPF (2026-08-25) — grava um `FiscalDocument` local
   * `type: "comprovante_nao_fiscal"`, sem NENHUMA chamada ao Bling/SEFAZ.
   * `externalId: saleId` é só um placeholder estável (não existe id real do
   * Bling pra esse tipo — nunca usado como chave de busca no Bling). Sempre
   * "issued" na hora: diferente da NFC-e, não tem nenhuma etapa assíncrona
   * de autorização esperando resultado externo.
   */
  private async recordNonFiscalReceipt(organizationId: string, saleId: string): Promise<void> {
    const existing = await this.fiscalDocumentRepository.findBySale(saleId);
    if (existing) {
      return;
    }
    const doc = await this.fiscalDocumentRepository.create({
      organizationId,
      provider: PROVIDER,
      saleId,
      externalId: saleId,
      type: "comprovante_nao_fiscal",
    });
    await this.fiscalDocumentRepository.update(doc.id, { status: "issued", issuedAt: new Date() });
  }

  private async updateFiscalDocumentFromBling(
    doc: FiscalDocument,
    details: {
      situacao: number | null;
      numero: string | null;
      chaveAcesso: string | null;
      linkDanfe: string | null;
      qrCodeUrl: string | null;
    },
  ): Promise<void> {
    const status = mapSituacaoToStatus(details.situacao);
    await this.fiscalDocumentRepository.update(doc.id, {
      status,
      externalStatus: details.situacao,
      documentNumber: details.numero,
      accessKey: details.chaveAcesso,
      danfeUrl: details.linkDanfe,
      qrCodeUrl: details.qrCodeUrl,
      errorMessage: null,
      // Só grava issuedAt na transição pra "issued" — não sobrescreve um
      // valor já setado numa consulta anterior com null caso a situação
      // volte a ler algo diferente de autorizada/emitida numa nova poll.
      ...(status === "issued" && !doc.issuedAt ? { issuedAt: new Date() } : {}),
    });
  }

  private isNfceAutoEmitEnabled(): boolean {
    return this.configService.get<string>("BLING_NFCE_AUTO_EMIT") === "true";
  }

  private async resolveProduct(accessToken: string, organizationId: string, sku: string, name: string): Promise<number> {
    const cached = await this.erpSyncMappingRepository.find(organizationId, PROVIDER, "product", sku);
    if (cached) {
      return Number(cached.externalId);
    }

    const product = await this.blingApiClient.findProductByCode(accessToken, sku);
    if (!product) {
      throw new Error(`Produto SKU "${sku}" (${name}) não encontrado no Bling — catálogo precisa estar sincronizado manualmente na V1.`);
    }

    await this.erpSyncMappingRepository.upsert({
      organizationId,
      provider: PROVIDER,
      localEntityType: "product",
      localEntityId: sku,
      externalId: String(product.id),
    });
    return product.id;
  }

  private async resolveDefaultContact(accessToken: string, organizationId: string): Promise<number> {
    const cached = await this.erpSyncMappingRepository.find(organizationId, PROVIDER, "contact", DEFAULT_CONTACT_KEY);
    if (cached) {
      return Number(cached.externalId);
    }

    let contact = await this.blingApiClient.findContactByName(accessToken, DEFAULT_CONTACT_NAME);
    if (!contact) {
      contact = await this.blingApiClient.createContact(accessToken, DEFAULT_CONTACT_NAME);
    }

    await this.erpSyncMappingRepository.upsert({
      organizationId,
      provider: PROVIDER,
      localEntityType: "contact",
      localEntityId: DEFAULT_CONTACT_KEY,
      externalId: String(contact.id),
    });
    return contact.id;
  }

  /**
   * Resolve/cria um contato Bling específico pra um CPF ("CPF na nota",
   * 2026-08-19) — mesmo padrão de `resolveDefaultContact`, mas o cache é
   * chaveado pelo PRÓPRIO CPF (`localEntityId: cpf`), nunca por
   * `Customer.id` local: `Customer.document` não tem `@unique` hoje, então
   * dois checkouts simultâneos com o mesmo CPF novo podem gerar dois
   * `Customer` locais — chavear pelo CPF garante que os dois convergem pro
   * MESMO contato Bling em vez de criar um duplicado por corrida.
   */
  private async resolveContactByCpf(
    accessToken: string,
    organizationId: string,
    cpf: string,
    name: string | null,
  ): Promise<number> {
    const cached = await this.erpSyncMappingRepository.find(organizationId, PROVIDER, "contact", cpf);
    if (cached) {
      return Number(cached.externalId);
    }

    let contact = await this.blingApiClient.findContactByDocument(accessToken, cpf);
    if (!contact) {
      contact = await this.blingApiClient.createContact(accessToken, name ?? `Consumidor CPF ${cpf}`, cpf);
    }

    await this.erpSyncMappingRepository.upsert({
      organizationId,
      provider: PROVIDER,
      localEntityType: "contact",
      localEntityId: cpf,
      externalId: String(contact.id),
    });
    return contact.id;
  }

  /**
   * Resolve a forma de pagamento **na conta Bling do próprio lojista**, em vez
   * de depender de um id fixo em env var. Bug real (2026-08-19): TODA venda
   * falhava com `"Id da forma de pagamento inválido"` (code 12) porque
   * `BLING_DEFAULT_PAYMENT_METHOD_ID` estava com um id que não existe nessa
   * conta — e o erro só ficou visível depois de passar a logar `error.fields`
   * do Bling. Config errada assim é praticamente inevitável no onboarding: o
   * id é específico de cada conta e a Sprint 7 concluiu (errado) que não dava
   * pra descobrir por API, deixando o lojista copiar à mão do painel.
   *
   * Ordem: cache (ErpSyncMapping) → conta Bling por `tipoPagamento` → forma
   * marcada como padrão na conta → qualquer ativa → só então as env vars
   * (que viram escape hatch, não mais o mecanismo principal).
   */
  private async resolvePaymentMethodId(
    accessToken: string,
    organizationId: string,
    method: string,
    cardType?: string | null,
    cardBrand?: string | null,
  ): Promise<number> {
    const key = [method, cardType, cardBrand].filter(Boolean).join("_");

    const cached = await this.erpSyncMappingRepository.find(organizationId, PROVIDER, "payment_method", key);
    if (cached) {
      return Number(cached.externalId);
    }

    const resolved = await this.resolvePaymentMethodFromAccount(accessToken, key, method, cardType, cardBrand);
    if (resolved !== null) {
      await this.erpSyncMappingRepository.upsert({
        organizationId,
        provider: PROVIDER,
        localEntityType: "payment_method",
        localEntityId: key,
        externalId: String(resolved),
      });
      this.logger.log(`Forma de pagamento "${key}" resolvida na conta Bling: id=${resolved}`);
      return resolved;
    }

    return this.resolveConfiguredPaymentMethodId(method, cardType);
  }

  private async resolvePaymentMethodFromAccount(
    accessToken: string,
    key: string,
    method: string,
    cardType?: string | null,
    cardBrand?: string | null,
  ): Promise<number | null> {
    let methods;
    try {
      methods = await this.blingApiClient.listPaymentMethods(accessToken);
    } catch (error) {
      this.logger.warn(`Não foi possível listar formas de pagamento do Bling: ${String(error)}`);
      return null;
    }

    // `situacao` ausente = conta antiga sem o campo; trata como ativa.
    const active = methods.filter((m) => m.situacao === undefined || m.situacao === 1);
    if (active.length === 0) {
      return null;
    }

    // Nome exato primeiro — é a ÚNICA forma de distinguir bandeira (Bling não
    // tem campo estruturado pra isso, ver expectedBlingDescricao acima).
    const expectedName = expectedBlingDescricao(method, cardType, cardBrand);
    if (expectedName) {
      const exact = active.find((m) => m.descricao === expectedName);
      if (exact) {
        return exact.id;
      }
    }

    for (const tipo of PREFERRED_TIPO_PAGAMENTO[key] ?? PREFERRED_TIPO_PAGAMENTO[method] ?? []) {
      const found = active.find((m) => m.tipoPagamento === tipo);
      if (found) {
        return found.id;
      }
    }

    return active.find((m) => m.padrao === 1)?.id ?? active[0]?.id ?? null;
  }

  /** Escape hatch: só usado quando a conta Bling não expõe nenhuma forma utilizável. */
  private resolveConfiguredPaymentMethodId(method: string, cardType?: string | null): number {
    const map = this.parsePaymentMethodIdMap();
    const specificKey = cardType ? `${method}_${cardType}` : method;
    const resolved = map[specificKey] ?? map[method];
    if (resolved !== undefined) {
      return resolved;
    }
    return this.resolveDefaultPaymentMethodId();
  }

  private parsePaymentMethodIdMap(): Record<string, number> {
    const raw = this.configService.get<string>("BLING_PAYMENT_METHOD_ID_MAP");
    if (!raw) {
      return {};
    }
    try {
      const parsed = JSON.parse(raw) as Record<string, number>;
      return parsed;
    } catch {
      this.logger.warn(
        "BLING_PAYMENT_METHOD_ID_MAP não é um JSON válido — ignorando, caindo pro BLING_DEFAULT_PAYMENT_METHOD_ID fixo.",
      );
      return {};
    }
  }

  private resolveDefaultPaymentMethodId(): number {
    const id = this.configService.get<string>("BLING_DEFAULT_PAYMENT_METHOD_ID");
    if (!id) {
      throw new Error(
        "BLING_DEFAULT_PAYMENT_METHOD_ID não configurado — Bling não tem endpoint de listagem de formas de pagamento, " +
          "pegue o id em Configurações > Formas de Pagamento no painel do Bling.",
      );
    }
    return Number(id);
  }
}
