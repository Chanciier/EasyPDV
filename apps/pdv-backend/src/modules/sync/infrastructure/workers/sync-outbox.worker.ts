import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { FlushSyncOutboxUseCase } from "../../application/use-cases/flush-sync-outbox.use-case.js";

const FLUSH_INTERVAL_MS = 15_000;

/**
 * Roda a cada 15s tentando entregar as entradas pendentes do outbox ao
 * Intermediador. Falha de rede/Intermediador indisponível nunca afeta a
 * venda — ela já foi gravada localmente antes desta entrada existir; a
 * entrada só é retentada no próximo tick. Ver docs/ERROR-HANDLING.md.
 */
@Injectable()
export class SyncOutboxWorker {
  private readonly logger = new Logger(SyncOutboxWorker.name);

  constructor(private readonly flushSyncOutboxUseCase: FlushSyncOutboxUseCase) {}

  @Interval(FLUSH_INTERVAL_MS)
  async flush() {
    const result = await this.flushSyncOutboxUseCase.execute();
    if (result.sent > 0 || result.failed > 0) {
      this.logger.log(`Sync outbox: ${result.sent} enviado(s), ${result.failed} falhou(aram)`);
    }
  }
}
