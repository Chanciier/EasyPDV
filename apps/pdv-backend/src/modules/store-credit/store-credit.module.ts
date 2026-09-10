import { Module } from "@nestjs/common";
import { PrismaStoreIdentityRepository } from "../provisioning/infrastructure/repositories/prisma-store-identity.repository.js";
import { STORE_IDENTITY_REPOSITORY } from "../provisioning/application/ports/store-identity-repository.port.js";
import { HttpStoreCreditGateway } from "./infrastructure/gateways/http-store-credit.gateway.js";
import { STORE_CREDIT_GATEWAY } from "./application/ports/store-credit-gateway.port.js";

/**
 * NÃO importa ProvisioningModule — mesmo motivo documentado em ClubModule
 * (2026-08-25, bug real de boot: ProvisioningModule → SalesModule →
 * StoreCreditModule [Fase 3, resgate] → ProvisioningModule fecharia o
 * ciclo). Registra o próprio STORE_IDENTITY_REPOSITORY aqui, mesma classe
 * `PrismaStoreIdentityRepository` que ProvisioningModule usa, instância
 * própria deste módulo (inofensivo, wrapper sem estado sobre o
 * PrismaService, que já é @Global).
 *
 * Fase 1 (2026-09-10): só o gateway — nenhum controller/use-case local
 * ainda, a UI (Fase 2) e o resgate na venda (Fase 3) consomem STORE_CREDIT_GATEWAY
 * depois. Ver Planejamento - Vale-Troca (Crédito por CPF).md no cofre Obsidian.
 */
@Module({
  providers: [
    { provide: STORE_IDENTITY_REPOSITORY, useClass: PrismaStoreIdentityRepository },
    { provide: STORE_CREDIT_GATEWAY, useClass: HttpStoreCreditGateway },
  ],
  exports: [STORE_CREDIT_GATEWAY],
})
export class StoreCreditModule {}
