import { Injectable } from "@nestjs/common";
import { BlingSyncTargetAdapter } from "../../infrastructure/adapters/bling/bling-sync-target.adapter.js";

/** Chamado pelo FiscalRetryWorker (@Interval). Ver docblock de `BlingSyncTargetAdapter.retryFailedFiscalDocuments`. */
@Injectable()
export class RetryFailedFiscalDocumentsUseCase {
  constructor(private readonly blingSyncTargetAdapter: BlingSyncTargetAdapter) {}

  execute(): Promise<{ attempted: number; succeeded: number }> {
    return this.blingSyncTargetAdapter.retryFailedFiscalDocuments();
  }
}
