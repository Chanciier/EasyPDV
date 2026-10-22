import { Inject, Injectable } from "@nestjs/common";
import { toErrorMessage } from "../../../../common/to-error-message.js";
import { SYNC_GATEWAY, type SyncGatewayPort } from "../ports/sync-gateway.port.js";
import { SYNC_OUTBOX_REPOSITORY, type SyncOutboxRepositoryPort } from "../ports/sync-outbox-repository.port.js";

export interface FlushSyncOutboxResult {
  sent: number;
  failed: number;
  /** true quando o lote parou cedo por falha de rede/central fora (PERF-05). */
  interrupted: boolean;
}

/** Status HTTP que significam "central fora/instável", não "esta entrada é inválida". */
const TRANSIENT_HTTP_STATUS = new Set([502, 503, 504]);

/**
 * Falha que não é culpa da entrada: sem rede, timeout, Railway devolvendo
 * 502/503/504. Duck typing no `getStatus` (HttpException do Nest) para a
 * camada de aplicação não depender do framework HTTP.
 */
function isTransientDeliveryError(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true; // fetch: "fetch failed" (DNS, conexão recusada, sem internet)
  }
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return true;
  }
  const getStatus = (error as { getStatus?: unknown } | null)?.getStatus;
  if (typeof getStatus === "function") {
    const status: unknown = getStatus.call(error);
    return typeof status === "number" && TRANSIENT_HTTP_STATUS.has(status);
  }
  return false;
}

/**
 * Varre as entradas pendentes do outbox e tenta entregar cada uma ao
 * Intermediador. Chamado periodicamente pelo SyncOutboxWorker.
 *
 * PERF-05 (2026-10-22): erro de uma entrada específica (4xx, 500 de regra)
 * só marca aquela e segue; falha de rede/timeout/central fora INTERROMPE o
 * lote — antes as 49 seguintes também esperavam 8 s de timeout cada (até
 * 400 s por flush) e ainda ganhavam `attempts` sem culpa, virando "failed"
 * antes da hora. Nesse caso a entrada só registra o erro, sem contar
 * tentativa. Idempotência por (entityType, entityId) no Intermediador segue
 * cobrindo reenvio.
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
        if (isTransientDeliveryError(error)) {
          await this.syncOutboxRepository.recordTransientError(entry.id, toErrorMessage(error));
          return { sent, failed, interrupted: true };
        }
        await this.syncOutboxRepository.markFailed(entry.id, toErrorMessage(error));
        failed++;
      }
    }

    return { sent, failed, interrupted: false };
  }
}
