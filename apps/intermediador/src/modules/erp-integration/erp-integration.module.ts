import { Module } from "@nestjs/common";
import { ErpIntegrationController } from "./infrastructure/controllers/erp-integration.controller.js";
import { BlingSyncTargetAdapter } from "./infrastructure/adapters/bling/bling-sync-target.adapter.js";
import { BlingApiClient } from "./infrastructure/clients/bling-api.client.js";
import { BlingOAuthClient } from "./infrastructure/clients/bling-oauth.client.js";
import { BlingTokenProviderService } from "./infrastructure/clients/bling-token-provider.service.js";
import { PrismaErpIntegrationRepository } from "./infrastructure/repositories/prisma-erp-integration.repository.js";
import { PrismaErpSyncMappingRepository } from "./infrastructure/repositories/prisma-erp-sync-mapping.repository.js";
import { ERP_INTEGRATION_REPOSITORY } from "./application/ports/erp-integration-repository.port.js";
import { ERP_SYNC_MAPPING_REPOSITORY } from "./application/ports/erp-sync-mapping-repository.port.js";
import { ConnectBlingUseCase } from "./application/use-cases/connect-bling.use-case.js";
import { HandleBlingCallbackUseCase } from "./application/use-cases/handle-bling-callback.use-case.js";
import { GetBlingConnectionStatusUseCase } from "./application/use-cases/get-bling-connection-status.use-case.js";

@Module({
  controllers: [ErpIntegrationController],
  providers: [
    BlingOAuthClient,
    BlingApiClient,
    BlingTokenProviderService,
    BlingSyncTargetAdapter,
    ConnectBlingUseCase,
    HandleBlingCallbackUseCase,
    GetBlingConnectionStatusUseCase,
    { provide: ERP_INTEGRATION_REPOSITORY, useClass: PrismaErpIntegrationRepository },
    { provide: ERP_SYNC_MAPPING_REPOSITORY, useClass: PrismaErpSyncMappingRepository },
  ],
  exports: [BlingSyncTargetAdapter],
})
export class ErpIntegrationModule {}
