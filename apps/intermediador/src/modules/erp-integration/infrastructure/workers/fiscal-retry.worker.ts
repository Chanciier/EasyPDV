import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { RetryFailedFiscalDocumentsUseCase } from "../../application/use-cases/retry-failed-fiscal-documents.use-case.js";

const RETRY_INTERVAL_MS = 10 * 60 * 1000;

/**
 * Varredura periódica pra NFC-e's rejeitadas (Sprint pós-704, 02/09/2026) —
 * mesmo padrão do SyncJobReconciliationWorker. Ver docblock de
 * `BlingSyncTargetAdapter.retryFailedFiscalDocuments`.
 */
@Injectable()
export class FiscalRetryWorker {
  private readonly logger = new Logger(FiscalRetryWorker.name);

  constructor(private readonly retryFailedFiscalDocumentsUseCase: RetryFailedFiscalDocumentsUseCase) {}

  @Interval(RETRY_INTERVAL_MS)
  async retry() {
    const { attempted, succeeded } = await this.retryFailedFiscalDocumentsUseCase.execute();
    if (attempted > 0) {
      this.logger.log(`Retry automático de NFC-e: ${succeeded}/${attempted} reenviada(s) com sucesso.`);
    }
  }
}
