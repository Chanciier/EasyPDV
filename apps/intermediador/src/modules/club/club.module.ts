import { Module } from "@nestjs/common";
import { OrganizationsModule } from "../organizations/organizations.module.js";
import { ErpIntegrationModule } from "../erp-integration/erp-integration.module.js";
import { TerminalApiKeyGuard } from "../organizations/infrastructure/guards/terminal-api-key.guard.js";
import { ClubController } from "./infrastructure/controllers/club.controller.js";
import { ClubExpirationCleanupWorker } from "./infrastructure/workers/club-expiration-cleanup.worker.js";
import { CheckClubMembershipUseCase } from "./application/use-cases/check-club-membership.use-case.js";
import { ListClubMembersUseCase } from "./application/use-cases/list-club-members.use-case.js";
import { AddClubMemberUseCase } from "./application/use-cases/add-club-member.use-case.js";
import { RemoveClubMemberUseCase } from "./application/use-cases/remove-club-member.use-case.js";

@Module({
  imports: [OrganizationsModule, ErpIntegrationModule],
  controllers: [ClubController],
  providers: [
    // Registrado de novo aqui (mesmo motivo documentado em erp-integration.module.ts/
    // sync.module.ts/organizations.module.ts): @UseGuards(TerminalApiKeyGuard) no
    // ClubController resolve a instância dentro deste módulo, não reaproveita
    // o singleton de OrganizationsModule.
    TerminalApiKeyGuard,
    CheckClubMembershipUseCase,
    ListClubMembersUseCase,
    AddClubMemberUseCase,
    RemoveClubMemberUseCase,
    ClubExpirationCleanupWorker,
  ],
})
export class ClubModule {}
