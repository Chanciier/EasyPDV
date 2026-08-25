import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { PrismaStoreIdentityRepository } from "../provisioning/infrastructure/repositories/prisma-store-identity.repository.js";
import { STORE_IDENTITY_REPOSITORY } from "../provisioning/application/ports/store-identity-repository.port.js";
import { ClubController } from "./infrastructure/controllers/club.controller.js";
import { HttpClubGateway } from "./infrastructure/gateways/http-club.gateway.js";
import { CLUB_GATEWAY } from "./application/ports/club-gateway.port.js";
import { CheckClubStatusUseCase } from "./application/use-cases/check-club-status.use-case.js";
import { ListClubMembersUseCase } from "./application/use-cases/list-club-members.use-case.js";
import { AddClubMemberUseCase } from "./application/use-cases/add-club-member.use-case.js";
import { RemoveClubMemberUseCase } from "./application/use-cases/remove-club-member.use-case.js";

/**
 * NÃO importa ProvisioningModule (2026-08-25, bug real de boot corrigido):
 * ProvisioningModule já importa SalesModule (pro GetTerminalBusyStatusUseCase,
 * ver provisioning.module.ts), e SalesModule importa ClubModule (pro
 * CLUB_GATEWAY de ApplyClubDiscountUseCase) — importar ProvisioningModule
 * aqui fecharia o ciclo Sales→Club→Provisioning→Sales, e o Nest quebra
 * inteiro no boot (UndefinedModuleException, "imports array is undefined").
 * Em vez disso regista o próprio STORE_IDENTITY_REPOSITORY aqui — a mesma
 * classe `PrismaStoreIdentityRepository` que ProvisioningModule usa, só que
 * numa instância própria deste módulo (inofensivo: é só um wrapper sem
 * estado em cima do PrismaService, que já é @Global).
 */
@Module({
  imports: [AuditModule],
  controllers: [ClubController],
  providers: [
    CheckClubStatusUseCase,
    ListClubMembersUseCase,
    AddClubMemberUseCase,
    RemoveClubMemberUseCase,
    { provide: STORE_IDENTITY_REPOSITORY, useClass: PrismaStoreIdentityRepository },
    { provide: CLUB_GATEWAY, useClass: HttpClubGateway },
  ],
  exports: [CLUB_GATEWAY],
})
export class ClubModule {}
