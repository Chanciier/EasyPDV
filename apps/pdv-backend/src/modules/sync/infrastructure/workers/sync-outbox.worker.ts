import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { FlushSyncOutboxUseCase } from "../../application/use-cases/flush-sync-outbox.use-case.js";

const FLUSH_INTERVAL_MS = 15_000;

/**
 * Roda a cada 15s tentando entregar as entradas pendentes do outbox ao
 * Intermediador. Falha de rede/Intermediador indisponível nunca afeta a
 * venda — ela já foi gravada localmente antes desta entrada existir; a
 * entrada só é retentada no próximo tick. Ver docs/ERROR-HANDLING.md.
 *
 * Trava de reentrância (2026-10-22, PERF-05): com a central lenta um flush
 * pode passar de 15 s, e o `@Interval` disparava outro por cima — dois
 * enviando as mesmas entradas e somando `attempts` em paralelo. Agora o tick
 * seguinte só sai cedo; a trava é liberada no `finally` mesmo com exceção.
 */
@Injectable()
export class SyncOutboxWorker {
  private readonly logger = new Logger(SyncOutboxWorker.name);

  constructor(private readonly flushSyncOutboxUseCase: FlushSyncOutboxUseCase) {}

  private running = false;

  @Interval(FLUSH_INTERVAL_MS)
  async flush() {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      const result = await this.flushSyncOutboxUseCase.execute();
      if (result.sent > 0 || result.failed > 0 || result.interrupted) {
        this.logger.log(
          `Sync outbox: ${result.sent} enviado(s), ${result.failed} falhou(aram)` +
            (result.interrupted ? " — lote interrompido (central fora/sem rede)" : ""),
        );
      }
    } catch (error) {
      this.logger.error(`Sync outbox: flush falhou: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.running = false;
    }
  }
}
