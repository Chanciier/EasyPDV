import { Inject, Injectable } from "@nestjs/common";
import {
  AUDIT_LOG_REPOSITORY,
  type AuditLogRepositoryPort,
} from "../../../audit/application/ports/audit-log-repository.port.js";
import { CLUB_GATEWAY, type ClubGatewayPort, type ClubMember, type AddClubMemberInput } from "../ports/club-gateway.port.js";

@Injectable()
export class AddClubMemberUseCase {
  constructor(
    @Inject(CLUB_GATEWAY) private readonly clubGateway: ClubGatewayPort,
    @Inject(AUDIT_LOG_REPOSITORY) private readonly auditLogRepository: AuditLogRepositoryPort,
  ) {}

  async execute(input: AddClubMemberInput, actorUserId: string | null): Promise<ClubMember> {
    const member = await this.clubGateway.addMember(input);
    await this.auditLogRepository.record({
      userId: actorUserId,
      action: "club.member_added",
      entityType: "club_member",
      entityId: input.document,
      metadata: { name: input.name, validUntil: input.validUntil },
    });
    return member;
  }
}
