import type { ErpSyncMapping } from "../../domain/entities/erp-sync-mapping.entity.js";
import type { ErpProviderCode } from "../../domain/entities/erp-integration.entity.js";

export interface UpsertErpSyncMappingData {
  organizationId: string;
  provider: ErpProviderCode;
  localEntityType: string;
  localEntityId: string;
  externalId: string;
}

export interface ErpSyncMappingRepositoryPort {
  find(
    organizationId: string,
    provider: ErpProviderCode,
    localEntityType: string,
    localEntityId: string,
  ): Promise<ErpSyncMapping | null>;
  upsert(data: UpsertErpSyncMappingData): Promise<ErpSyncMapping>;
}

export const ERP_SYNC_MAPPING_REPOSITORY = Symbol("ERP_SYNC_MAPPING_REPOSITORY");
