import { Inject, Injectable } from "@nestjs/common";
import type { OrgUserPayload } from "@easypdv/shared-types";
import { OrgUserNotFoundError } from "../../domain/errors.js";
import { ORG_USER_REPOSITORY, type OrgUserRepositoryPort } from "../ports/org-user-repository.port.js";
import { toOrgUserPayload } from "../mappers/org-user-payload.mapper.js";

/** `GET /organizations/:id/auth/me` — resolve o usuário do JWT já validado pelo OrgJwtAuthGuard. */
@Injectable()
export class GetCurrentOrgUserUseCase {
  constructor(@Inject(ORG_USER_REPOSITORY) private readonly orgUserRepository: OrgUserRepositoryPort) {}

  async execute(orgUserId: string): Promise<OrgUserPayload> {
    const user = await this.orgUserRepository.findById(orgUserId);
    if (!user) {
      throw new OrgUserNotFoundError(orgUserId);
    }
    return toOrgUserPayload(user);
  }
}
