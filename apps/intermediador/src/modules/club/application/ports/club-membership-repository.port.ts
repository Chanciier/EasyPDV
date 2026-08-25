import type { ErpProviderCode } from "../../../erp-integration/domain/entities/erp-integration.entity.js";
import type { ClubMembership } from "../../domain/entities/club-membership.entity.js";

export interface UpsertClubMembershipData {
  organizationId: string;
  provider: ErpProviderCode;
  customerCpf: string;
  validUntil: Date;
}

export interface ClubMembershipRepositoryPort {
  findByCpf(organizationId: string, provider: ErpProviderCode, customerCpf: string): Promise<ClubMembership | null>;
  upsert(data: UpsertClubMembershipData): Promise<ClubMembership>;
  delete(organizationId: string, provider: ErpProviderCode, customerCpf: string): Promise<void>;
  deleteExpired(before: Date): Promise<number>;
}

export const CLUB_MEMBERSHIP_REPOSITORY = Symbol("CLUB_MEMBERSHIP_REPOSITORY");
