import { Inject, Injectable } from "@nestjs/common";
import type { SyncJob } from "../../domain/entities/sync-job.entity.js";
import { SyncJobNotFoundError } from "../../domain/errors.js";
import { SYNC_JOB_REPOSITORY, type SyncJobRepositoryPort } from "../ports/sync-job-repository.port.js";

@Injectable()
export class GetSyncJobUseCase {
  constructor(@Inject(SYNC_JOB_REPOSITORY) private readonly syncJobRepository: SyncJobRepositoryPort) {}

  async execute(id: string): Promise<SyncJob> {
    const job = await this.syncJobRepository.findById(id);
    if (!job) {
      throw new SyncJobNotFoundError(id);
    }
    return job;
  }
}
