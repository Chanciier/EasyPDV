import { Inject, Injectable } from "@nestjs/common";
import {
  AUDIT_LOG_REPOSITORY,
  type AuditLogRepositoryPort,
} from "../../../audit/application/ports/audit-log-repository.port.js";
import { CLUB_GATEWAY, type ClubGatewayPort } from "../ports/club-gateway.port.js";

@Injectable()
export class RemoveClubMemberUseCase {
  constructor(
    @Inject(CLUB_GATEWAY) private readonly clubGateway: ClubGatewayPort,
    @Inject(AUDIT_LOG_REPOSITORY) private readonly auditLogRepository: AuditLogRepositoryPort,
  ) {}

  async execute(document: string, actorUserId: string | null): Promise<void> {
    await this.clubGateway.removeMember(document);
    await this.auditLogRepository.record({
      userId: actorUserId,
      action: "club.member_removed",
      entityType: "club_member",
      entityId: document,
    });
  }
}
