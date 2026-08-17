import { Inject, Injectable } from "@nestjs/common";
import type { SyncStatusSummary } from "@easypdv/shared-types";
import { SYNC_OUTBOX_REPOSITORY, type SyncOutboxRepositoryPort } from "../ports/sync-outbox-repository.port.js";

/** "Modo contingência" básico (Sprint 15) — indicador pra qualquer operador, ver SyncController. */
@Injectable()
export class GetSyncStatusUseCase {
  constructor(@Inject(SYNC_OUTBOX_REPOSITORY) private readonly syncOutboxRepository: SyncOutboxRepositoryPort) {}

  async execute(): Promise<SyncStatusSummary> {
    const [pending, failed] = await Promise.all([
      this.syncOutboxRepository.findMany({ status: "pending", limit: 1000 }),
      this.syncOutboxRepository.findMany({ status: "failed", limit: 1000 }),
    ]);
    return { pendingCount: pending.length, failedCount: failed.length };
  }
}
