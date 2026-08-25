import type { ClubMembership as ClubMembershipRecord } from "../../../../generated/prisma/index.js";
import { ClubMembership } from "../../domain/entities/club-membership.entity.js";

export function toDomainClubMembership(record: ClubMembershipRecord): ClubMembership {
  return new ClubMembership({
    id: record.id,
    organizationId: record.organizationId,
    provider: record.provider,
    customerCpf: record.customerCpf,
    validUntil: record.validUntil,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}
