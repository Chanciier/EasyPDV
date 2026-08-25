import { Injectable } from "@nestjs/common";
import { BlingSyncTargetAdapter } from "../../../erp-integration/infrastructure/adapters/bling/bling-sync-target.adapter.js";

@Injectable()
export class CheckClubMembershipUseCase {
  constructor(private readonly blingSyncTargetAdapter: BlingSyncTargetAdapter) {}

  execute(organizationId: string, document: string): Promise<boolean> {
    return this.blingSyncTargetAdapter.checkClubMembership(organizationId, document);
  }
}
