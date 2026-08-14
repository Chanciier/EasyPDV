import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ErpIntegrationModule } from "../erp-integration/erp-integration.module.js";
import { BlingSyncTargetAdapter } from "../erp-integration/infrastructure/adapters/bling/bling-sync-target.adapter.js";
import { SyncController } from "./infrastructure/controllers/sync.controller.js";
import { BullSyncQueueAdapter } from "./infrastructure/queues/bull-sync-queue.adapter.js";
import { SyncProcessor } from "./infrastructure/processors/sync.processor.js";
import { SyncJobReconciliationWorker } from "./infrastructure/workers/sync-job-reconciliation.worker.js";
import { PrismaSyncJobRepository } from "./infrastructure/repositories/prisma-sync-job.repository.js";
import { SYNC_JOB_REPOSITORY } from "./application/ports/sync-job-repository.port.js";
import { SYNC_QUEUE } from "./application/ports/sync-queue.port.js";
import { SYNC_TARGET } from "./application/ports/sync-target.port.js";
import { RequestSyncUseCase } from "./application/use-cases/request-sync.use-case.js";
import { GetSyncJobUseCase } from "./application/use-cases/get-sync-job.use-case.js";
import { ListSyncJobsUseCase } from "./application/use-cases/list-sync-jobs.use-case.js";
import { RetrySyncJobUseCase } from "./application/use-cases/retry-sync-job.use-case.js";
import { ProcessSyncJobUseCase } from "./application/use-cases/process-sync-job.use-case.js";
import { ReconcileOrphanedSyncJobsUseCase } from "./application/use-cases/reconcile-orphaned-sync-jobs.use-case.js";
import { SYNC_QUEUE_NAME } from "./sync.constants.js";

@Module({
  imports: [BullModule.registerQueue({ name: SYNC_QUEUE_NAME }), ErpIntegrationModule],
  controllers: [SyncController],
  providers: [
    RequestSyncUseCase,
    GetSyncJobUseCase,
    ListSyncJobsUseCase,
    RetrySyncJobUseCase,
    ProcessSyncJobUseCase,
    ReconcileOrphanedSyncJobsUseCase,
    SyncProcessor,
    SyncJobReconciliationWorker,
    { provide: SYNC_JOB_REPOSITORY, useClass: PrismaSyncJobRepository },
    { provide: SYNC_QUEUE, useClass: BullSyncQueueAdapter },
    // Sprint 7: Adapter Bling real substitui o NoopSyncTargetAdapter (Sprint 6) —
    // este último continua no código como dublê de teste pra ambientes sem
    // credenciais Bling (ver infrastructure/adapters/noop/).
    { provide: SYNC_TARGET, useExisting: BlingSyncTargetAdapter },
  ],
})
export class SyncModule {}
