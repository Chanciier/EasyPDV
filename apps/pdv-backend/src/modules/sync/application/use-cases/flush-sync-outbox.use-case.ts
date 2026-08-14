import { Inject, Injectable } from "@nestjs/common";
import { SYNC_GATEWAY, type SyncGatewayPort } from "../ports/sync-gateway.port.js";
import { SYNC_OUTBOX_REPOSITORY, type SyncOutboxRepositoryPort } from "../ports/sync-outbox-repository.port.js";

export interface FlushSyncOutboxResult {
  sent: number;
  failed: number;
}

/**
 * Varre as entradas pendentes do outbox e tenta entregar cada uma ao
 * Intermediador. Chamado periodicamente pelo SyncOutboxWorker. Falha em uma
 * entrada não interrompe as demais.
 */
@Injectable()
export class FlushSyncOutboxUseCase {
  constructor(
    @Inject(SYNC_OUTBOX_REPOSITORY) private readonly syncOutboxRepository: SyncOutboxRepositoryPort,
    @Inject(SYNC_GATEWAY) private readonly syncGateway: SyncGatewayPort,
  ) {}

  async execute(): Promise<FlushSyncOutboxResult> {
    const pending = await this.syncOutboxRepository.findMany({ status: "pending", limit: 50 });
    let sent = 0;
    let failed = 0;

    for (const entry of pending) {
      try {
        await this.syncGateway.send({
          entityType: entry.entityType,
          entityId: entry.entityId,
          payload: JSON.parse(entry.payload) as unknown,
        });
        await this.syncOutboxRepository.markSent(entry.id);
        sent++;
      } catch (error) {
        await this.syncOutboxRepository.markFailed(entry.id, error instanceof Error ? error.message : String(error));
        failed++;
      }
    }

    return { sent, failed };
  }
}
