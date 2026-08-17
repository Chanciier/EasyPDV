import { Module } from "@nestjs/common";
import { ProvisioningModule } from "../provisioning/provisioning.module.js";
import { SyncController } from "./infrastructure/controllers/sync.controller.js";
import { HttpSyncGateway } from "./infrastructure/gateways/http-sync.gateway.js";
import { PrismaSyncOutboxRepository } from "./infrastructure/repositories/prisma-sync-outbox.repository.js";
import { SyncOutboxWorker } from "./infrastructure/workers/sync-outbox.worker.js";
import { SYNC_GATEWAY } from "./application/ports/sync-gateway.port.js";
import { SYNC_OUTBOX_REPOSITORY } from "./application/ports/sync-outbox-repository.port.js";
import { FlushSyncOutboxUseCase } from "./application/use-cases/flush-sync-outbox.use-case.js";
import { ListSyncOutboxUseCase } from "./application/use-cases/list-sync-outbox.use-case.js";
import { RetrySyncOutboxEntryUseCase } from "./application/use-cases/retry-sync-outbox-entry.use-case.js";
import { GetSyncStatusUseCase } from "./application/use-cases/get-sync-status.use-case.js";

@Module({
  imports: [ProvisioningModule],
  controllers: [SyncController],
  providers: [
    FlushSyncOutboxUseCase,
    ListSyncOutboxUseCase,
    RetrySyncOutboxEntryUseCase,
    GetSyncStatusUseCase,
    SyncOutboxWorker,
    { provide: SYNC_OUTBOX_REPOSITORY, useClass: PrismaSyncOutboxRepository },
    { provide: SYNC_GATEWAY, useClass: HttpSyncGateway },
  ],
})
export class SyncModule {}
