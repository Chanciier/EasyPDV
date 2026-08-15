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
 * cacheado via ErpSyncMapping). Forma de pagamento vem de config
 * (BLING_DEFAULT_PAYMENT_METHOD_ID) — Bling não expõe endpoint de listagem,
 * o id só existe no painel do Bling (Configurações > Formas de Pagamento),
 * confirmado contra a API real na Sprint 7.
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
    const formaPagamentoId = this.resolveDefaultPaymentMethodId();

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
    details: { situacao: number | null; numero: string | null; chaveAcesso: string | null; linkDanfe: string | null },
  ): Promise<void> {
    const status = mapSituacaoToStatus(details.situacao);
    await this.fiscalDocumentRepository.update(doc.id, {
      status,
      externalStatus: details.situacao,
      documentNumber: details.numero,
      accessKey: details.chaveAcesso,
      danfeUrl: details.linkDanfe,
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
