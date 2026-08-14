import { Inject, Injectable } from "@nestjs/common";
import type { SyncJob } from "../../domain/entities/sync-job.entity.js";
import {
  SYNC_JOB_REPOSITORY,
  type SyncJobRepositoryPort,
  type UpsertPendingSyncJobData,
} from "../ports/sync-job-repository.port.js";
import { SYNC_QUEUE, type SyncQueuePort } from "../ports/sync-queue.port.js";

/**
 * Recebe uma entrada de sync do PDV local (via POST /sync). Idempotente:
 * reenvio do mesmo entityId (timeout ambíguo do lado do PDV local, por
 * exemplo) não cria um segundo job — só reenfileira se o job existente
 * tiver falhado. Ver docs/ERROR-HANDLING.md.
 */
@Injectable()
export class RequestSyncUseCase {
  constructor(
    @Inject(SYNC_JOB_REPOSITORY) private readonly syncJobRepository: SyncJobRepositoryPort,
    @Inject(SYNC_QUEUE) private readonly syncQueue: SyncQueuePort,
  ) {}

  async execute(data: UpsertPendingSyncJobData): Promise<SyncJob> {
    const { job, isNew } = await this.syncJobRepository.upsertPending(data);
    if (isNew || job.status === "failed") {
      await this.syncQueue.enqueue(job.id);
    }
    return job;
  }
}
