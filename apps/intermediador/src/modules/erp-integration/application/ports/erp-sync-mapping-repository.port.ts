import type { ErpSyncMapping } from "../../domain/entities/erp-sync-mapping.entity.js";
import type { ErpProviderCode } from "../../domain/entities/erp-integration.entity.js";

/**
 * Antes era `string` livre, com os mesmos ~9 literais mágicos espalhados por
 * BlingSyncTargetAdapter/HandleBlingCallbackUseCase — um typo em qualquer um
 * não dava erro de compilação, só fazia o cache nunca bater (refazendo a
 * chamada ao Bling toda vez) ou criava uma entrada nova sem ninguém notar.
 */
export type ErpSyncMappingEntityType =
  | "product"
  | "contact"
  | "contact_type"
  | "payment_method"
  | "order_situacao"
  | "warehouse"
  | "sale"
  | "sale_situacao"
  | "sale_stock"
  | "sale_void_stock";

export interface UpsertErpSyncMappingData {
  organizationId: string;
  provider: ErpProviderCode;
  localEntityType: ErpSyncMappingEntityType;
  localEntityId: string;
  externalId: string;
}

export interface ErpSyncMappingRepositoryPort {
  find(
    organizationId: string,
    provider: ErpProviderCode,
    localEntityType: ErpSyncMappingEntityType,
    localEntityId: string,
  ): Promise<ErpSyncMapping | null>;
  upsert(data: UpsertErpSyncMappingData): Promise<ErpSyncMapping>;
  deleteByTypes(
    organizationId: string,
    provider: ErpProviderCode,
    localEntityTypes: ErpSyncMappingEntityType[],
  ): Promise<number>;
}

export const ERP_SYNC_MAPPING_REPOSITORY = Symbol("ERP_SYNC_MAPPING_REPOSITORY");
