import { Module } from "@nestjs/common";
import { ProvisioningModule } from "../provisioning/provisioning.module.js";
import { AuditModule } from "../audit/audit.module.js";
import { ClubController } from "./infrastructure/controllers/club.controller.js";
import { HttpClubGateway } from "./infrastructure/gateways/http-club.gateway.js";
import { CLUB_GATEWAY } from "./application/ports/club-gateway.port.js";
import { CheckClubStatusUseCase } from "./application/use-cases/check-club-status.use-case.js";
import { ListClubMembersUseCase } from "./application/use-cases/list-club-members.use-case.js";
import { AddClubMemberUseCase } from "./application/use-cases/add-club-member.use-case.js";
import { RemoveClubMemberUseCase } from "./application/use-cases/remove-club-member.use-case.js";

@Module({
  imports: [ProvisioningModule, AuditModule],
  controllers: [ClubController],
  providers: [
    CheckClubStatusUseCase,
    ListClubMembersUseCase,
    AddClubMemberUseCase,
    RemoveClubMemberUseCase,
    { provide: CLUB_GATEWAY, useClass: HttpClubGateway },
  ],
  exports: [CLUB_GATEWAY],
})
export class ClubModule {}
