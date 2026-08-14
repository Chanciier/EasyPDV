import { Inject, Injectable } from "@nestjs/common";
import { SyncJobNotFoundError, SyncJobNotRetryableError } from "../../domain/errors.js";
import { SYNC_JOB_REPOSITORY, type SyncJobRepositoryPort } from "../ports/sync-job-repository.port.js";
import { SYNC_QUEUE, type SyncQueuePort } from "../ports/sync-queue.port.js";

/** Retry manual (Central de Erros de Sincronização, Sprint 8) — só jobs "failed". */
@Injectable()
export class RetrySyncJobUseCase {
  constructor(
    @Inject(SYNC_JOB_REPOSITORY) private readonly syncJobRepository: SyncJobRepositoryPort,
    @Inject(SYNC_QUEUE) private readonly syncQueue: SyncQueuePort,
  ) {}

  async execute(id: string): Promise<void> {
    const job = await this.syncJobRepository.findById(id);
    if (!job) {
      throw new SyncJobNotFoundError(id);
    }
    // resetToPending é a checagem que vale de verdade (UPDATE condicional
    // atômico) — o status lido acima só serve pra mensagem de erro, pode
    // estar defasado se outra requisição mudou o job nesse meio-tempo.
    const wasReset = await this.syncJobRepository.resetToPending(id);
    if (!wasReset) {
      throw new SyncJobNotRetryableError(id, job.status);
    }
    await this.syncQueue.enqueue(id);
  }
}
