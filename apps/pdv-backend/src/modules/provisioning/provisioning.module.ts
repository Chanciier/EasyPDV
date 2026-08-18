import { Module } from "@nestjs/common";
import { SalesModule } from "../sales/sales.module.js";
import { CatalogModule } from "../catalog/catalog.module.js";
import { ProvisioningController } from "./infrastructure/controllers/provisioning.controller.js";
import { PrismaStoreIdentityRepository } from "./infrastructure/repositories/prisma-store-identity.repository.js";
import { HttpActivationCodeGateway } from "./infrastructure/gateways/http-activation-code.gateway.js";
import { STORE_IDENTITY_REPOSITORY } from "./application/ports/store-identity-repository.port.js";
import { ACTIVATION_CODE_GATEWAY } from "./application/ports/activation-code-gateway.port.js";
import { GetProvisioningStatusUseCase } from "./application/use-cases/get-provisioning-status.use-case.js";
import { ActivateTerminalUseCase } from "./application/use-cases/activate-terminal.use-case.js";
import { GenerateActivationCodeUseCase } from "./application/use-cases/generate-activation-code.use-case.js";

@Module({
  // SalesModule/CatalogModule não importam ProvisioningModule de volta — não
  // é ciclo, só leitura entre módulos (GetTerminalBusyStatusUseCase,
  // SyncProductsFromBlingUseCase). Ver docs/MODULES.md.
  imports: [SalesModule, CatalogModule],
  controllers: [ProvisioningController],
  providers: [
    GetProvisioningStatusUseCase,
    ActivateTerminalUseCase,
    GenerateActivationCodeUseCase,
    { provide: STORE_IDENTITY_REPOSITORY, useClass: PrismaStoreIdentityRepository },
    { provide: ACTIVATION_CODE_GATEWAY, useClass: HttpActivationCodeGateway },
  ],
  // ActivateTerminalUseCase é consumido pelo Sync module (HttpSyncGateway lê
  // a apiKey via StoreIdentityRepositoryPort). Ver docs/MODULES.md.
  exports: [STORE_IDENTITY_REPOSITORY],
})
export class ProvisioningModule {}
