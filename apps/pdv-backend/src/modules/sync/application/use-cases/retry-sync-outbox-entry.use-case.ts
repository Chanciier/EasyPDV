import { Inject, Injectable } from "@nestjs/common";
import { SyncOutboxEntryNotFoundError, SyncOutboxEntryNotRetryableError } from "../../domain/errors.js";
import { SYNC_OUTBOX_REPOSITORY, type SyncOutboxRepositoryPort } from "../ports/sync-outbox-repository.port.js";

/** Retry manual (Central de Erros de Sincronização, Sprint 8) — só entradas "failed". */
@Injectable()
export class RetrySyncOutboxEntryUseCase {
  constructor(@Inject(SYNC_OUTBOX_REPOSITORY) private readonly syncOutboxRepository: SyncOutboxRepositoryPort) {}

  async execute(id: string): Promise<void> {
    const entry = await this.syncOutboxRepository.findById(id);
    if (!entry) {
      throw new SyncOutboxEntryNotFoundError(id);
    }
    // resetToPending é a checagem que vale de verdade (UPDATE condicional
    // atômico) — o status lido acima só serve pra mensagem de erro.
    const wasReset = await this.syncOutboxRepository.resetToPending(id);
    if (!wasReset) {
      throw new SyncOutboxEntryNotRetryableError(id, entry.status);
    }
  }
}
