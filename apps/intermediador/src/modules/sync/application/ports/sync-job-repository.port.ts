import type { SyncJob } from "../../domain/entities/sync-job.entity.js";

export interface UpsertPendingSyncJobData {
  entityType: string;
  entityId: string;
  payload: unknown;
  storeId?: string;
}

export interface SyncJobRepositoryPort {
  /** Idempotente por (entityType, entityId): se já existir um job, retorna-o sem duplicar. */
  upsertPending(data: UpsertPendingSyncJobData): Promise<{ job: SyncJob; isNew: boolean }>;
  findById(id: string): Promise<SyncJob | null>;
  markProcessing(id: string): Promise<void>;
  markSynced(id: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
}

export const SYNC_JOB_REPOSITORY = Symbol("SYNC_JOB_REPOSITORY");
