import { Inject, Injectable } from "@nestjs/common";
import { SYNC_JOB_REPOSITORY, type SyncJobRepositoryPort } from "../ports/sync-job-repository.port.js";
import { SYNC_TARGET, type SyncTargetPort } from "../ports/sync-target.port.js";

/**
 * Executado pelo SyncProcessor (worker BullMQ) a cada job da fila "sync".
 * Relança o erro após marcar o job como "failed" para que o BullMQ aplique
 * a política de retry/backoff configurada no enqueue (ver BullSyncQueueAdapter).
 */
@Injectable()
export class ProcessSyncJobUseCase {
  constructor(
    @Inject(SYNC_JOB_REPOSITORY) private readonly syncJobRepository: SyncJobRepositoryPort,
    @Inject(SYNC_TARGET) private readonly syncTarget: SyncTargetPort,
  ) {}

  async execute(syncJobId: string): Promise<void> {
    const job = await this.syncJobRepository.findById(syncJobId);
    if (!job) {
      return;
    }

    await this.syncJobRepository.markProcessing(job.id);
    try {
      await this.syncTarget.process({ entityType: job.entityType, entityId: job.entityId, payload: job.payload });
      await this.syncJobRepository.markSynced(job.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.syncJobRepository.markFailed(job.id, message);
      throw error;
    }
  }
}
