import { Inject, Injectable } from "@nestjs/common";
import type { OrgUser } from "../../domain/entities/org-user.entity.js";
import { ORG_USER_REPOSITORY, type OrgUserRepositoryPort } from "../ports/org-user-repository.port.js";

@Injectable()
export class ListOrgUsersUseCase {
  constructor(@Inject(ORG_USER_REPOSITORY) private readonly orgUserRepository: OrgUserRepositoryPort) {}

  execute(organizationId: string): Promise<OrgUser[]> {
    return this.orgUserRepository.findAllByOrganization(organizationId);
  }
}
