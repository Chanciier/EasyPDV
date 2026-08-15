import type {
  ErpIntegration as PrismaErpIntegration,
  ErpSyncMapping as PrismaErpSyncMapping,
  FiscalDocument as PrismaFiscalDocument,
} from "../../../../generated/prisma/index.js";
import { ErpIntegration } from "../../domain/entities/erp-integration.entity.js";
import { ErpSyncMapping } from "../../domain/entities/erp-sync-mapping.entity.js";
import { FiscalDocument } from "../../domain/entities/fiscal-document.entity.js";

export function toDomainErpIntegration(record: PrismaErpIntegration): ErpIntegration {
  return new ErpIntegration({
    id: record.id,
    organizationId: record.organizationId,
    provider: record.provider,
    accessToken: record.accessToken,
    refreshToken: record.refreshToken,
    expiresAt: record.expiresAt,
    connectedAt: record.connectedAt,
    updatedAt: record.updatedAt,
  });
}

export function toDomainErpSyncMapping(record: PrismaErpSyncMapping): ErpSyncMapping {
  return new ErpSyncMapping({
    id: record.id,
    organizationId: record.organizationId,
    provider: record.provider,
    localEntityType: record.localEntityType,
    localEntityId: record.localEntityId,
    externalId: record.externalId,
    createdAt: record.createdAt,
  });
}

export function toDomainFiscalDocument(record: PrismaFiscalDocument): FiscalDocument {
  return new FiscalDocument({
    id: record.id,
    organizationId: record.organizationId,
    provider: record.provider,
    saleId: record.saleId,
    type: record.type,
    status: record.status,
    externalId: record.externalId,
    externalStatus: record.externalStatus,
    documentNumber: record.documentNumber,
    accessKey: record.accessKey,
    danfeUrl: record.danfeUrl,
    errorMessage: record.errorMessage,
    issuedAt: record.issuedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}
