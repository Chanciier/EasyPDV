import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ErpIntegration } from "../../domain/entities/erp-integration.entity.js";
import { BlingOAuthClient } from "../../infrastructure/clients/bling-oauth.client.js";
import { ERP_INTEGRATION_REPOSITORY, type ErpIntegrationRepositoryPort } from "../ports/erp-integration-repository.port.js";
import { ERP_SYNC_MAPPING_REPOSITORY, type ErpSyncMappingRepositoryPort } from "../ports/erp-sync-mapping-repository.port.js";

/**
 * Tipos de mapeamento "resolvidos uma vez e reaproveitados por qualquer
 * venda futura" — em oposição a "sale"/"sale_stock", que são marcas de
 * idempotência de UMA venda específica já processada e não precisam (nem
 * devem) ser invalidadas numa reconexão.
 */
const REUSABLE_MAPPING_TYPES = ["contact", "payment_method", "warehouse", "product"];

@Injectable()
export class HandleBlingCallbackUseCase {
  private readonly logger = new Logger(HandleBlingCallbackUseCase.name);

  constructor(
    private readonly oauthClient: BlingOAuthClient,
    @Inject(ERP_INTEGRATION_REPOSITORY) private readonly erpIntegrationRepository: ErpIntegrationRepositoryPort,
    @Inject(ERP_SYNC_MAPPING_REPOSITORY) private readonly erpSyncMappingRepository: ErpSyncMappingRepositoryPort,
  ) {}

  /**
   * Achado numa venda real (2026-08-19): trocar de conta Bling (organização
   * mantida, login Bling diferente) deixa o `ErpSyncMapping` cheio de ids
   * externos da conta ANTIGA — contato "Consumidor Final", forma de
   * pagamento, depósito, produto. Bling rejeita a venda com 400 genérico
   * porque esses ids não existem na conta nova. Toda reconexão (troca de
   * conta ou simples refresh) limpa esse cache reaproveitável — reconectar
   * na MESMA conta só causa uma re-resolução idêntica e barata; reconectar
   * numa conta DIFERENTE é o caso que isso corrige de verdade.
   */
  async execute(code: string, state: string): Promise<ErpIntegration> {
    const organizationId = Buffer.from(state, "base64url").toString("utf8");
    const token = await this.oauthClient.exchangeCode(code);
    const integration = await this.erpIntegrationRepository.upsert({
      organizationId,
      provider: "bling",
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAt: token.expiresAt,
    });

    const cleared = await this.erpSyncMappingRepository.deleteByTypes(organizationId, "bling", REUSABLE_MAPPING_TYPES);
    if (cleared > 0) {
      this.logger.log(`Reconexão Bling: ${cleared} mapeamento(s) em cache invalidado(s) pra organização ${organizationId}`);
    }

    return integration;
  }
}
