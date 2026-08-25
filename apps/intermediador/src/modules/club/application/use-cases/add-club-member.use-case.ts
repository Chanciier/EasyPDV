import { Injectable } from "@nestjs/common";
import { onlyDigits } from "@easypdv/shared-validation";
import { BlingSyncTargetAdapter } from "../../../erp-integration/infrastructure/adapters/bling/bling-sync-target.adapter.js";
import type { ClubMemberSummary } from "../../domain/entities/club-member-summary.js";

@Injectable()
export class AddClubMemberUseCase {
  constructor(private readonly blingSyncTargetAdapter: BlingSyncTargetAdapter) {}

  execute(organizationId: string, name: string, document: string, validUntil: string): Promise<ClubMemberSummary> {
    return this.blingSyncTargetAdapter.addClubMember(organizationId, name, onlyDigits(document), new Date(validUntil));
  }
}
