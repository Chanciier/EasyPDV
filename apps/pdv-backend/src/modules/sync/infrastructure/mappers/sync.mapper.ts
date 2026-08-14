import type { SyncOutbox as PrismaSyncOutbox } from "@prisma/client";
import { SyncOutboxEntry } from "../../domain/entities/sync-outbox-entry.entity.js";

export function toDomainSyncOutboxEntry(record: PrismaSyncOutbox): SyncOutboxEntry {
  return new SyncOutboxEntry({
    id: record.id,
    entityType: record.entityType,
    entityId: record.entityId,
    payload: record.payload,
    status: record.status,
    attempts: record.attempts,
    lastError: record.lastError,
    createdAt: record.createdAt,
    sentAt: record.sentAt,
  });
}
