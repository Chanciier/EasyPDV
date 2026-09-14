import { Module } from "@nestjs/common";
import { OrganizationsModule } from "../organizations/organizations.module.js";
import { ErpIntegrationModule } from "../erp-integration/erp-integration.module.js";
import { CustomersModule } from "../customers/customers.module.js";
import { TerminalApiKeyGuard } from "../organizations/infrastructure/guards/terminal-api-key.guard.js";
import { ClubController } from "./infrastructure/controllers/club.controller.js";
import { AdminClubController } from "./infrastructure/controllers/admin-club.controller.js";
import { ClubExpirationCleanupWorker } from "./infrastructure/workers/club-expiration-cleanup.worker.js";
import { CheckClubMembershipUseCase } from "./application/use-cases/check-club-membership.use-case.js";
import { ListClubMembersUseCase } from "./application/use-cases/list-club-members.use-case.js";
import { ListClubMembersForAdminUseCase } from "./application/use-cases/list-club-members-for-admin.use-case.js";
import { AddClubMemberUseCase } from "./application/use-cases/add-club-member.use-case.js";
import { RemoveClubMemberUseCase } from "./application/use-cases/remove-club-member.use-case.js";

// CustomersModule importado (2026-09-14) pra AddClubMemberUseCase gravar o
// Customer central — mesma direção já usada com ErpIntegrationModule
// (feature puxa de outro módulo, nunca o contrário; sem ciclo, CustomersModule
// não importa ClubModule). SetWhatsappConsentUseCase (exportado por
// CustomersModule) é injetado direto em AdminClubController pelo mesmo import.
@Module({
  imports: [OrganizationsModule, ErpIntegrationModule, CustomersModule],
  // AdminClubController (Fase 2, 2026-09-14) — fronteira de confiança
  // diferente de ClubController (OrgJwtAuthGuard, não TerminalApiKeyGuard),
  // por isso controller separado em vez de misturar guards no mesmo.
  controllers: [ClubController, AdminClubController],
  providers: [
    // Registrado de novo aqui (mesmo motivo documentado em erp-integration.module.ts/
    // sync.module.ts/organizations.module.ts): @UseGuards(TerminalApiKeyGuard) no
    // ClubController resolve a instância dentro deste módulo, não reaproveita
    // o singleton de OrganizationsModule. OrgJwtAuthGuard (AdminClubController)
    // não precisa do mesmo tratamento — extends AuthGuard("jwt") sem
    // dependências próprias de DI, resolve a strategy "jwt" pelo registro
    // global do Passport (OrgJwtStrategy já instanciada via OrganizationsModule
    // em AppModule), não pelo container deste módulo.
    TerminalApiKeyGuard,
    CheckClubMembershipUseCase,
    ListClubMembersUseCase,
    ListClubMembersForAdminUseCase,
    AddClubMemberUseCase,
    RemoveClubMemberUseCase,
    ClubExpirationCleanupWorker,
  ],
})
export class ClubModule {}
