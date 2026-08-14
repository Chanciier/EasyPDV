import type { ErpIntegration, ErpProviderCode } from "../../domain/entities/erp-integration.entity.js";

export interface UpsertErpIntegrationData {
  organizationId: string;
  provider: ErpProviderCode;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface ErpIntegrationRepositoryPort {
  upsert(data: UpsertErpIntegrationData): Promise<ErpIntegration>;
  findByOrganization(organizationId: string, provider: ErpProviderCode): Promise<ErpIntegration | null>;
  /**
   * V1 simplificação single-tenant: sem roteamento real por loja ainda
   * (provisionamento de terminal é Sprint 10) — usado pelo BlingSyncAdapter
   * pra resolver "a" integração ativa quando o SyncJob não carrega storeId.
   */
  findFirstActive(provider: ErpProviderCode): Promise<ErpIntegration | null>;
}

export const ERP_INTEGRATION_REPOSITORY = Symbol("ERP_INTEGRATION_REPOSITORY");
