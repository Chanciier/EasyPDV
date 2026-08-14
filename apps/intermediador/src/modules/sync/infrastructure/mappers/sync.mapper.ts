import type { SyncJob as PrismaSyncJob } from "../../../../generated/prisma/index.js";
import { SyncJob } from "../../domain/entities/sync-job.entity.js";

export function toDomainSyncJob(record: PrismaSyncJob): SyncJob {
  return new SyncJob({
    id: record.id,
    storeId: record.storeId,
    entityType: record.entityType,
    entityId: record.entityId,
    payload: record.payload,
    status: record.status,
    attempts: record.attempts,
    lastError: record.lastError,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}
