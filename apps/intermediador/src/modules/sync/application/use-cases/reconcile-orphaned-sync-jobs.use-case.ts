import { Inject, Injectable } from "@nestjs/common";
import { SYNC_JOB_REPOSITORY, type SyncJobRepositoryPort } from "../ports/sync-job-repository.port.js";

// Um SyncJob só fica "processing" por segundos em operação normal (chamada
// HTTP pro Bling); falha da API resolve pra "failed" via BullMQ retry+rethrow
// (ver ProcessSyncJobUseCase). "processing" travado por muito mais tempo que
// isso só acontece se o worker morrer (crash/restart) ou o Redis perder o job
// no meio do processamento — cenário estreito, mas sem essa varredura o job
// ficava travado pra sempre sem aparecer em lugar nenhum (risco rastreado
// desde a Sprint 6/7).
const STUCK_THRESHOLD_MS = 5 * 60 * 1000;

export interface ReconcileResult {
  reconciled: number;
}

/** Central de Erros de Sincronização (Sprint 8) — não reenfileira sozinho, só marca "failed" pra aparecer na lista e ser retentado manualmente. */
@Injectable()
export class ReconcileOrphanedSyncJobsUseCase {
  constructor(@Inject(SYNC_JOB_REPOSITORY) private readonly syncJobRepository: SyncJobRepositoryPort) {}

  async execute(): Promise<ReconcileResult> {
    const threshold = new Date(Date.now() - STUCK_THRESHOLD_MS);
    const orphaned = await this.syncJobRepository.findOrphanedProcessing(threshold);

    for (const job of orphaned) {
      await this.syncJobRepository.markFailed(
        job.id,
        `Job travado em "processing" por mais de ${STUCK_THRESHOLD_MS / 60_000}min — provável perda do worker/Redis. ` +
          "Marcado como failed pela varredura de reconciliação; revisar e reenfileirar manualmente (POST /sync/jobs/:id/retry).",
      );
    }

    return { reconciled: orphaned.length };
  }
}
