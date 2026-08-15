import { Module } from "@nestjs/common";
import { OrganizationsController } from "./infrastructure/controllers/organizations.controller.js";
import { TerminalsController } from "./infrastructure/controllers/terminals.controller.js";
import { TerminalApiKeyGuard } from "./infrastructure/guards/terminal-api-key.guard.js";
import { PrismaOrganizationRepository } from "./infrastructure/repositories/prisma-organization.repository.js";
import { PrismaStoreRepository } from "./infrastructure/repositories/prisma-store.repository.js";
import { PrismaActivationCodeRepository } from "./infrastructure/repositories/prisma-activation-code.repository.js";
import { PrismaTerminalRepository } from "./infrastructure/repositories/prisma-terminal.repository.js";
import { ORGANIZATION_REPOSITORY } from "./application/ports/organization-repository.port.js";
import { STORE_REPOSITORY } from "./application/ports/store-repository.port.js";
import { ACTIVATION_CODE_REPOSITORY } from "./application/ports/activation-code-repository.port.js";
import { TERMINAL_REPOSITORY } from "./application/ports/terminal-repository.port.js";
import { CreateOrganizationUseCase } from "./application/use-cases/create-organization.use-case.js";
import { GenerateActivationCodeUseCase } from "./application/use-cases/generate-activation-code.use-case.js";
import { ActivateTerminalUseCase } from "./application/use-cases/activate-terminal.use-case.js";
import { VerifyTerminalApiKeyUseCase } from "./application/use-cases/verify-terminal-api-key.use-case.js";

@Module({
  controllers: [OrganizationsController, TerminalsController],
  providers: [
    CreateOrganizationUseCase,
    GenerateActivationCodeUseCase,
    ActivateTerminalUseCase,
    VerifyTerminalApiKeyUseCase,
    TerminalApiKeyGuard,
    { provide: ORGANIZATION_REPOSITORY, useClass: PrismaOrganizationRepository },
    { provide: STORE_REPOSITORY, useClass: PrismaStoreRepository },
    { provide: ACTIVATION_CODE_REPOSITORY, useClass: PrismaActivationCodeRepository },
    { provide: TERMINAL_REPOSITORY, useClass: PrismaTerminalRepository },
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
