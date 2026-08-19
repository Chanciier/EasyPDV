import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { SaleSyncPayload } from "@easypdv/shared-types";
import type { SyncTargetInput, SyncTargetPort } from "../../../../sync/application/ports/sync-target.port.js";
import type { ErpProviderCode } from "../../../domain/entities/erp-integration.entity.js";
import { ErpIntegrationNotFoundError } from "../../../domain/errors.js";
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
import { BlingApiClient } from "../../clients/bling-api.client.js";
import { BlingTokenProviderService } from "../../clients/bling-token-provider.service.js";

const PROVIDER: ErpProviderCode = "bling";
const DEFAULT_CONTACT_NAME = "Consumidor Final";
const DEFAULT_CONTACT_KEY = "default";

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
 * Só sabe processar entityType="sale" por enquanto (estoque não sincroniza
 * com o Bling ainda). V1 simplificação single-tenant: resolve "a" integração
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
    private readonly tokenProvider: BlingTokenProviderService,
    private readonly blingApiClient: BlingApiClient,
    private readonly configService: ConfigService,
  ) {}

  async process(input: SyncTargetInput): Promise<void> {
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

    if (this.isNfceAutoEmitEnabled()) {
      await this.ensureFiscalDocument(accessToken, organizationId, payload.saleId, orderExternalId);
    }
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

    const contatoId = await this.resolveDefaultContact(accessToken, organizationId);
    const primaryPayment = payload.payments?.[0];
    const formaPagamentoId = primaryPayment
      ? this.resolvePaymentMethodId(primaryPayment.method, primaryPayment.cardType)
      : this.resolveDefaultPaymentMethodId();

    const items = [];
    for (const item of payload.items) {
      const produtoId = await this.resolveProduct(accessToken, organizationId, item.sku, item.name);
      items.push({ produtoId, quantidade: item.quantity, valor: item.unitPrice, descricao: item.name || item.sku });
    }

    const dueDate = payload.confirmedAt.slice(0, 10);
    const result = await this.blingApiClient.createSalesOrder(accessToken, {
      contatoId,
      formaPagamentoId,
      totalAmount: payload.totalAmount,
      discountAmount: computeOrderDiscount(items, payload.totalAmount),
      dueDate,
      items,
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
   * Chave do mapa: "cartao_credito"/"cartao_debito" quando cardType existe,
   * senão só o method ("dinheiro"/"pix"/"outro"/"cartao" sem detalhe). Sem
   * entrada específica no mapa (ou sem BLING_PAYMENT_METHOD_ID_MAP definida),
   * cai pro id fixo único de sempre — onboarding continua exigindo só uma
   * env var nova opcional, não um cadastro à parte.
   */
  private resolvePaymentMethodId(method: string, cardType?: string | null): number {
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
