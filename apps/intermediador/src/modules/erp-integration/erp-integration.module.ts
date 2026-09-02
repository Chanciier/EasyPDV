import { Module } from "@nestjs/common";
import { OrganizationsModule } from "../organizations/organizations.module.js";
import { TerminalApiKeyGuard } from "../organizations/infrastructure/guards/terminal-api-key.guard.js";
import { ErpIntegrationController } from "./infrastructure/controllers/erp-integration.controller.js";
import { FiscalController } from "./infrastructure/controllers/fiscal.controller.js";
import { FiscalRetryWorker } from "./infrastructure/workers/fiscal-retry.worker.js";
import { BlingSyncTargetAdapter } from "./infrastructure/adapters/bling/bling-sync-target.adapter.js";
import { BlingApiClient } from "./infrastructure/clients/bling-api.client.js";
import { BlingOAuthClient } from "./infrastructure/clients/bling-oauth.client.js";
import { BlingTokenProviderService } from "./infrastructure/clients/bling-token-provider.service.js";
import { PrismaErpIntegrationRepository } from "./infrastructure/repositories/prisma-erp-integration.repository.js";
import { PrismaErpSyncMappingRepository } from "./infrastructure/repositories/prisma-erp-sync-mapping.repository.js";
import { PrismaFiscalDocumentRepository } from "./infrastructure/repositories/prisma-fiscal-document.repository.js";
import { PrismaClubMembershipRepository } from "../club/infrastructure/repositories/prisma-club-membership.repository.js";
import { ERP_INTEGRATION_REPOSITORY } from "./application/ports/erp-integration-repository.port.js";
import { ERP_SYNC_MAPPING_REPOSITORY } from "./application/ports/erp-sync-mapping-repository.port.js";
import { FISCAL_DOCUMENT_REPOSITORY } from "./application/ports/fiscal-document-repository.port.js";
import { CLUB_MEMBERSHIP_REPOSITORY } from "../club/application/ports/club-membership-repository.port.js";
import { ConnectBlingUseCase } from "./application/use-cases/connect-bling.use-case.js";
import { HandleBlingCallbackUseCase } from "./application/use-cases/handle-bling-callback.use-case.js";
import { GetBlingConnectionStatusUseCase } from "./application/use-cases/get-bling-connection-status.use-case.js";
import { GetFiscalStatusUseCase } from "./application/use-cases/get-fiscal-status.use-case.js";
import { IssueFiscalReceiptManuallyUseCase } from "./application/use-cases/issue-fiscal-receipt-manually.use-case.js";
import { RetryFiscalDocumentUseCase } from "./application/use-cases/retry-fiscal-document.use-case.js";
import { RetryFailedFiscalDocumentsUseCase } from "./application/use-cases/retry-failed-fiscal-documents.use-case.js";
import { ListBlingProductsUseCase } from "./application/use-cases/list-bling-products.use-case.js";

@Module({
  imports: [OrganizationsModule],
  controllers: [ErpIntegrationController, FiscalController],
  providers: [
    // Registrado de novo aqui (mesmo motivo documentado em sync.module.ts e
    // organizations.module.ts): @UseGuards(TerminalApiKeyGuard) no
    // FiscalController resolve a instância dentro deste módulo, não
    // reaproveita o singleton de OrganizationsModule.
    TerminalApiKeyGuard,
    BlingOAuthClient,
    BlingApiClient,
    BlingTokenProviderService,
    BlingSyncTargetAdapter,
    ConnectBlingUseCase,
    HandleBlingCallbackUseCase,
    GetBlingConnectionStatusUseCase,
    GetFiscalStatusUseCase,
    IssueFiscalReceiptManuallyUseCase,
    RetryFiscalDocumentUseCase,
    RetryFailedFiscalDocumentsUseCase,
    FiscalRetryWorker,
    ListBlingProductsUseCase,
    { provide: ERP_INTEGRATION_REPOSITORY, useClass: PrismaErpIntegrationRepository },
    { provide: ERP_SYNC_MAPPING_REPOSITORY, useClass: PrismaErpSyncMappingRepository },
    { provide: FISCAL_DOCUMENT_REPOSITORY, useClass: PrismaFiscalDocumentRepository },
    { provide: CLUB_MEMBERSHIP_REPOSITORY, useClass: PrismaClubMembershipRepository },
  ],
  // CLUB_MEMBERSHIP_REPOSITORY também exportado: ClubModule importa este
  // módulo pra pegar o BlingSyncTargetAdapter, mas ClubExpirationCleanupWorker
  // (que vive em ClubModule) também precisa resolver esse provider direto —
  // bug real de boot corrigido (2026-08-25): sem isso o Nest derruba a
  // aplicação inteira na subida com UnknownDependenciesException.
  exports: [BlingSyncTargetAdapter, CLUB_MEMBERSHIP_REPOSITORY],
})
export class ErpIntegrationModule {}
