import { Inject, Injectable } from "@nestjs/common";
import type { CreateUserInput } from "@easypdv/shared-validation";
import { OrgUserEmailAlreadyInUseError } from "../../domain/errors.js";
import type { OrgUser } from "../../domain/entities/org-user.entity.js";
import { PASSWORD_HASHER, type PasswordHasherPort } from "../ports/password-hasher.port.js";
import { ORG_USER_REPOSITORY, type OrgUserRepositoryPort } from "../ports/org-user-repository.port.js";

/** Mesmo formato de CreateUserUseCase (pdv-backend/identity), só que canônico por organização. */
@Injectable()
export class CreateOrgUserUseCase {
  constructor(
    @Inject(ORG_USER_REPOSITORY) private readonly orgUserRepository: OrgUserRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(organizationId: string, input: CreateUserInput): Promise<OrgUser> {
    const existing = await this.orgUserRepository.findByOrganizationAndEmail(organizationId, input.email);
    if (existing) {
      throw new OrgUserEmailAlreadyInUseError(input.email);
    }
    const passwordHash = await this.passwordHasher.hash(input.password);
    const maxEmployeeCode = await this.orgUserRepository.getMaxEmployeeCode(organizationId);
    return this.orgUserRepository.create({
      organizationId,
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
      employeeCode: maxEmployeeCode + 1,
    });
  }
}
