import { Injectable } from "@nestjs/common";
import { BlingSyncTargetAdapter } from "../../../erp-integration/infrastructure/adapters/bling/bling-sync-target.adapter.js";
import type { ClubMemberSummary } from "../../domain/entities/club-member-summary.js";

@Injectable()
export class ListClubMembersUseCase {
  constructor(private readonly blingSyncTargetAdapter: BlingSyncTargetAdapter) {}

  execute(organizationId: string): Promise<ClubMemberSummary[]> {
    return this.blingSyncTargetAdapter.listClubMembers(organizationId);
  }
}
