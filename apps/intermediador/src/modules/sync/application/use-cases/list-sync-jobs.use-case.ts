import { Inject, Injectable } from "@nestjs/common";
import type { SyncJob, SyncJobStatus } from "../../domain/entities/sync-job.entity.js";
import { SYNC_JOB_REPOSITORY, type SyncJobRepositoryPort } from "../ports/sync-job-repository.port.js";

/** Central de Erros de Sincronização (Sprint 8) — visibilidade dos SyncJobs. */
@Injectable()
export class ListSyncJobsUseCase {
  constructor(@Inject(SYNC_JOB_REPOSITORY) private readonly syncJobRepository: SyncJobRepositoryPort) {}

  execute(status?: SyncJobStatus): Promise<SyncJob[]> {
    return this.syncJobRepository.findMany({ status, limit: 100 });
  }
}
