import { Module } from "@nestjs/common";
import { SalesModule } from "../sales/sales.module.js";
import { ProvisioningController } from "./infrastructure/controllers/provisioning.controller.js";
import { PrismaStoreIdentityRepository } from "./infrastructure/repositories/prisma-store-identity.repository.js";
import { STORE_IDENTITY_REPOSITORY } from "./application/ports/store-identity-repository.port.js";
import { GetProvisioningStatusUseCase } from "./application/use-cases/get-provisioning-status.use-case.js";
import { ActivateTerminalUseCase } from "./application/use-cases/activate-terminal.use-case.js";

@Module({
  // SalesModule não importa ProvisioningModule de volta — não é ciclo,
  // só leitura entre módulos (GetTerminalBusyStatusUseCase). Ver docs/MODULES.md.
  imports: [SalesModule],
  controllers: [ProvisioningController],
  providers: [
    GetProvisioningStatusUseCase,
    ActivateTerminalUseCase,
    { provide: STORE_IDENTITY_REPOSITORY, useClass: PrismaStoreIdentityRepository },
  ],
  // ActivateTerminalUseCase é consumido pelo Sync module (HttpSyncGateway lê
  // a apiKey via StoreIdentityRepositoryPort). Ver docs/MODULES.md.
  exports: [STORE_IDENTITY_REPOSITORY],
})
export class ProvisioningModule {}
