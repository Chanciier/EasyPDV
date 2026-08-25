import { Injectable } from "@nestjs/common";
import { onlyDigits } from "@easypdv/shared-validation";
import { BlingSyncTargetAdapter } from "../../../erp-integration/infrastructure/adapters/bling/bling-sync-target.adapter.js";

@Injectable()
export class RemoveClubMemberUseCase {
  constructor(private readonly blingSyncTargetAdapter: BlingSyncTargetAdapter) {}

  execute(organizationId: string, document: string): Promise<void> {
    return this.blingSyncTargetAdapter.removeClubMember(organizationId, onlyDigits(document));
  }
}
