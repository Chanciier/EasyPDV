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
   * Achado C3 da auditoria de segurança (2026-09-14, cofre Obsidian
   * "Decisões e Riscos Abertos" #20) — este método é a causa raiz do bug de
   * contaminação cross-organização: resolve "a" integração mais antiga do
   * sistema INTEIRO, ignorando qual organização deveria usar. 7 dos 9 usos
   * em BlingSyncTargetAdapter já foram corrigidos pra `findByOrganization`.
   * Os 2 que restam (`process`/`processVoid`, dirigidos por `SyncJob`, que
   * ainda não carrega `organizationId`) só podem ser corrigidos depois de
   * uma migration no schema — não remover este método antes disso.
   */
  findFirstActive(provider: ErpProviderCode): Promise<ErpIntegration | null>;
}

export const ERP_INTEGRATION_REPOSITORY = Symbol("ERP_INTEGRATION_REPOSITORY");
