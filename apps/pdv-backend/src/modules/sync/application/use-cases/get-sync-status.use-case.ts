import { Inject, Injectable } from "@nestjs/common";
import type { SyncStatusSummary } from "@easypdv/shared-types";
import { SYNC_OUTBOX_REPOSITORY, type SyncOutboxRepositoryPort } from "../ports/sync-outbox-repository.port.js";

/**
 * "Modo contingência" básico (Sprint 15) — indicador pra qualquer operador,
 * ver SyncController. Chamado a cada 15 s por todo terminal: desde
 * 2026-10-22 (PERF-04) usa COUNT no índice de status em vez de carregar até
 * 2.000 linhas com payload (e a contagem não satura mais em 1000).
 */
@Injectable()
export class GetSyncStatusUseCase {
  constructor(@Inject(SYNC_OUTBOX_REPOSITORY) private readonly syncOutboxRepository: SyncOutboxRepositoryPort) {}

  async execute(): Promise<SyncStatusSummary> {
    const [pendingCount, failedCount] = await Promise.all([
      this.syncOutboxRepository.countByStatus("pending"),
      this.syncOutboxRepository.countByStatus("failed"),
    ]);
    return { pendingCount, failedCount };
  }
}
