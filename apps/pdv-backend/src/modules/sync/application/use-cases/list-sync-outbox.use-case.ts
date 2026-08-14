import { Inject, Injectable } from "@nestjs/common";
import type { SyncOutboxEntry, SyncOutboxStatus } from "../../domain/entities/sync-outbox-entry.entity.js";
import { SYNC_OUTBOX_REPOSITORY, type SyncOutboxRepositoryPort } from "../ports/sync-outbox-repository.port.js";

/** Visibilidade do outbox para depuração/operação — base da Central de Erros de Sincronização (Sprint 8). */
@Injectable()
export class ListSyncOutboxUseCase {
  constructor(@Inject(SYNC_OUTBOX_REPOSITORY) private readonly syncOutboxRepository: SyncOutboxRepositoryPort) {}

  execute(status?: SyncOutboxStatus): Promise<SyncOutboxEntry[]> {
    return this.syncOutboxRepository.findMany({ status, limit: 100 });
  }
}
