import { Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { ProcessSyncJobUseCase } from "../../application/use-cases/process-sync-job.use-case.js";
import { SYNC_QUEUE_NAME } from "../../sync.constants.js";

@Processor(SYNC_QUEUE_NAME)
export class SyncProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncProcessor.name);

  constructor(private readonly processSyncJobUseCase: ProcessSyncJobUseCase) {
    super();
  }

  async process(job: Job<{ syncJobId: string }>): Promise<void> {
    this.logger.log(`Processando sync job ${job.data.syncJobId} (tentativa ${job.attemptsMade + 1})`);
    await this.processSyncJobUseCase.execute(job.data.syncJobId);
  }
}
