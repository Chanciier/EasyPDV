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
import { BlingApiClient } from "../../clients/bling-api.client.js";
import { BlingTokenProviderService } from "../../clients/bling-token-provider.service.js";

const PROVIDER: ErpProviderCode = "bling";
const DEFAULT_CONTACT_NAME = "Consumidor Final";
const DEFAULT_CONTACT_KEY = "default";

/**
 * Implementa a mesma SyncTargetPort do NoopSyncTargetAdapter (Sprint 6) —
 * substituição transparente, sem tocar no SyncProcessor nem nos use-cases.
 * Só sabe processar entityType="sale" por enquanto (fiscal/estoque não
 * sincronizam com o Bling ainda). V1 simplificação single-tenant: resolve
 * "a" integração ativa em vez de rotear por loja (Sprint 10 resolve isso
 * de verdade). Contato usa um valor padrão fixo ("Consumidor Final",
 * resolvido/criado e cacheado via ErpSyncMapping). Forma de pagamento vem
 * de config (BLING_DEFAULT_PAYMENT_METHOD_ID) — Bling não expõe endpoint
 * de listagem, o id só existe no painel do Bling (Configurações > Formas
 * de Pagamento), confirmado contra a API real na Sprint 7.
 */
@Injectable()
export class BlingSyncTargetAdapter implements SyncTargetPort {
  private readonly logger = new Logger(BlingSyncTargetAdapter.name);

  constructor(
    @Inject(ERP_INTEGRATION_REPOSITORY) private readonly erpIntegrationRepository: ErpIntegrationRepositoryPort,
    @Inject(ERP_SYNC_MAPPING_REPOSITORY) private readonly erpSyncMappingRepository: ErpSyncMappingRepositoryPort,
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
