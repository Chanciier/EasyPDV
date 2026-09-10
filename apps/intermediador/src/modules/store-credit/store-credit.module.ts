import { Module } from "@nestjs/common";
import { OrganizationsModule } from "../organizations/organizations.module.js";
import { TerminalApiKeyGuard } from "../organizations/infrastructure/guards/terminal-api-key.guard.js";
import { StoreCreditController } from "./infrastructure/controllers/store-credit.controller.js";
import { PrismaStoreCreditRepository } from "./infrastructure/repositories/prisma-store-credit.repository.js";
import { STORE_CREDIT_REPOSITORY } from "./application/ports/store-credit-repository.port.js";
import { GetStoreCreditBalanceUseCase } from "./application/use-cases/get-store-credit-balance.use-case.js";
import { GrantStoreCreditUseCase } from "./application/use-cases/grant-store-credit.use-case.js";
import { RedeemStoreCreditUseCase } from "./application/use-cases/redeem-store-credit.use-case.js";

@Module({
  imports: [OrganizationsModule],
  controllers: [StoreCreditController],
  providers: [
    // Registrado de novo aqui (mesmo motivo de ClubModule/ErpIntegrationModule/
    // SyncModule): @UseGuards(TerminalApiKeyGuard) no StoreCreditController
    // resolve a instância dentro DESTE módulo, não reaproveita o singleton
    // de OrganizationsModule. Ver docs/MODULES.md.
    TerminalApiKeyGuard,
    GetStoreCreditBalanceUseCase,
    GrantStoreCreditUseCase,
    RedeemStoreCreditUseCase,
    { provide: STORE_CREDIT_REPOSITORY, useClass: PrismaStoreCreditRepository },
  ],
})
export class StoreCreditModule {}
