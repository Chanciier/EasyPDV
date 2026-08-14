import type { SyncJob, SyncJobStatus } from "../../domain/entities/sync-job.entity.js";

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
  findMany(params?: { status?: SyncJobStatus; limit?: number }): Promise<SyncJob[]>;
  /** Central de Erros (Sprint 8): jobs travados em "processing" há mais de `olderThan` — worker/Redis perdeu o job no meio do processamento. */
  findOrphanedProcessing(olderThan: Date): Promise<SyncJob[]>;
  markProcessing(id: string): Promise<void>;
  markSynced(id: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
  /**
   * Retry manual (Central de Erros, Sprint 8): volta pra "pending" sem
   * reenfileirar — quem enfileira é o use-case, via SyncQueuePort. UPDATE
   * condicional (só aplica se status atual for "failed") pra evitar que dois
   * cliques em retry enfileirem dois jobs BullMQ em paralelo pro mesmo
   * SyncJob — `createSalesOrder` não é idempotente, duplicaria o pedido no
   * Bling. Retorna false se o job não estava mais "failed" (corrida perdida).
   */
  resetToPending(id: string): Promise<boolean>;
}

export const SYNC_JOB_REPOSITORY = Symbol("SYNC_JOB_REPOSITORY");
