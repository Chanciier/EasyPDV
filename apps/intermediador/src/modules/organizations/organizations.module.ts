import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { OrganizationsController } from "./infrastructure/controllers/organizations.controller.js";
import { OrgUsersController } from "./infrastructure/controllers/org-users.controller.js";
import { TerminalsController } from "./infrastructure/controllers/terminals.controller.js";
import { TerminalApiKeyGuard } from "./infrastructure/guards/terminal-api-key.guard.js";
import { VerifyLoginThrottlerGuard } from "./infrastructure/guards/verify-login-throttler.guard.js";
import { PrismaOrganizationRepository } from "./infrastructure/repositories/prisma-organization.repository.js";
import { PrismaStoreRepository } from "./infrastructure/repositories/prisma-store.repository.js";
import { PrismaActivationCodeRepository } from "./infrastructure/repositories/prisma-activation-code.repository.js";
import { PrismaTerminalRepository } from "./infrastructure/repositories/prisma-terminal.repository.js";
import { PrismaOrgUserRepository } from "./infrastructure/repositories/prisma-org-user.repository.js";
import { BcryptPasswordHasher } from "./infrastructure/services/bcrypt-password-hasher.service.js";
import { ORGANIZATION_REPOSITORY } from "./application/ports/organization-repository.port.js";
import { STORE_REPOSITORY } from "./application/ports/store-repository.port.js";
import { ACTIVATION_CODE_REPOSITORY } from "./application/ports/activation-code-repository.port.js";
import { TERMINAL_REPOSITORY } from "./application/ports/terminal-repository.port.js";
import { ORG_USER_REPOSITORY } from "./application/ports/org-user-repository.port.js";
import { PASSWORD_HASHER } from "./application/ports/password-hasher.port.js";
import { CreateOrganizationUseCase } from "./application/use-cases/create-organization.use-case.js";
import { GenerateActivationCodeUseCase } from "./application/use-cases/generate-activation-code.use-case.js";
import { ActivateTerminalUseCase } from "./application/use-cases/activate-terminal.use-case.js";
import { VerifyTerminalApiKeyUseCase } from "./application/use-cases/verify-terminal-api-key.use-case.js";
import { CreateOrgUserUseCase } from "./application/use-cases/create-org-user.use-case.js";
import { ListOrgUsersUseCase } from "./application/use-cases/list-org-users.use-case.js";
import { UpdateOrgUserUseCase } from "./application/use-cases/update-org-user.use-case.js";
import { VerifyOrgUserLoginUseCase } from "./application/use-cases/verify-org-user-login.use-case.js";

@Module({
  // ThrottlerModule só é usado pelo VerifyLoginThrottlerGuard (POST
  // .../verify-login) — não é global (sem APP_GUARD), de propósito: os
  // demais endpoints deste módulo (e de outros) não devem ficar limitados
  // por isso. Ver docs/DATABASE.md "OrgUser" pro raciocínio completo do
  // login único entre terminais (2026-08-21).
  imports: [ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 5 }])],
  controllers: [OrganizationsController, OrgUsersController, TerminalsController],
  providers: [
    CreateOrganizationUseCase,
    GenerateActivationCodeUseCase,
    ActivateTerminalUseCase,
    VerifyTerminalApiKeyUseCase,
    CreateOrgUserUseCase,
    ListOrgUsersUseCase,
    UpdateOrgUserUseCase,
    VerifyOrgUserLoginUseCase,
    TerminalApiKeyGuard,
    VerifyLoginThrottlerGuard,
    { provide: ORGANIZATION_REPOSITORY, useClass: PrismaOrganizationRepository },
    { provide: STORE_REPOSITORY, useClass: PrismaStoreRepository },
    { provide: ACTIVATION_CODE_REPOSITORY, useClass: PrismaActivationCodeRepository },
    { provide: TERMINAL_REPOSITORY, useClass: PrismaTerminalRepository },
    { provide: ORG_USER_REPOSITORY, useClass: PrismaOrgUserRepository },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
  ],
  // TerminalApiKeyGuard é consumido pelo SyncModule (POST /sync). Exporta os
  // dois — guard E use-case — porque @UseGuards(Classe) resolve a instância
  // dentro do módulo DONO do controller (SyncModule), não reaproveita o
  // singleton já construído aqui: sem VerifyTerminalApiKeyUseCase também
  // exportado, SyncModule não consegue montar as dependências do guard
  // (erro real, achado rodando os dois módulos juntos pela primeira vez —
  // "Nest can't resolve dependencies of the TerminalApiKeyGuard"). SyncModule
  // registra TerminalApiKeyGuard de novo nos próprios providers pelo mesmo
  // motivo. Ver docs/MODULES.md.
  exports: [TerminalApiKeyGuard, VerifyTerminalApiKeyUseCase],
})
export class OrganizationsModule {}
