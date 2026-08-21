import { Inject, Injectable } from "@nestjs/common";
import type { UpdateOrgUserInput } from "@easypdv/shared-validation";
import { OrgUserNotFoundError } from "../../domain/errors.js";
import type { OrgUser } from "../../domain/entities/org-user.entity.js";
import { ORG_USER_REPOSITORY, type OrgUserRepositoryPort } from "../ports/org-user-repository.port.js";

@Injectable()
export class UpdateOrgUserUseCase {
  constructor(@Inject(ORG_USER_REPOSITORY) private readonly orgUserRepository: OrgUserRepositoryPort) {}

  async execute(id: string, input: UpdateOrgUserInput): Promise<OrgUser> {
    const existing = await this.orgUserRepository.findById(id);
    if (!existing) {
      throw new OrgUserNotFoundError(id);
    }
    return this.orgUserRepository.update(id, { role: input.role, active: input.active });
  }
}
