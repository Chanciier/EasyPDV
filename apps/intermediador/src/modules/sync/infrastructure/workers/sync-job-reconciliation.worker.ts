import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { ReconcileOrphanedSyncJobsUseCase } from "../../application/use-cases/reconcile-orphaned-sync-jobs.use-case.js";

const RECONCILIATION_INTERVAL_MS = 2 * 60 * 1000;

/** Central de Erros de Sincronização (Sprint 8) — varredura periódica de SyncJobs órfãos. */
@Injectable()
export class SyncJobReconciliationWorker {
  private readonly logger = new Logger(SyncJobReconciliationWorker.name);

  constructor(private readonly reconcileOrphanedSyncJobsUseCase: ReconcileOrphanedSyncJobsUseCase) {}

  @Interval(RECONCILIATION_INTERVAL_MS)
  async reconcile() {
    const { reconciled } = await this.reconcileOrphanedSyncJobsUseCase.execute();
    if (reconciled > 0) {
      this.logger.warn(`Reconciliação: ${reconciled} SyncJob(s) órfão(s) marcado(s) como "failed".`);
    }
  }
}
