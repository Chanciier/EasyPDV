import { Inject, Injectable } from "@nestjs/common";
import type { CreateOrganizationInput } from "@easypdv/shared-validation";
import type { Organization } from "../../domain/entities/organization.entity.js";
import { ORGANIZATION_REPOSITORY, type OrganizationRepositoryPort } from "../ports/organization-repository.port.js";

/**
 * Bootstrapping de organização — sem UI de admin ainda (fora do escopo da
 * Sprint 10). Chamado manualmente (curl/Postman) por quem está provisionando
 * um cliente novo do EasyPDV. Ver docs/API.md.
 */
@Injectable()
export class CreateOrganizationUseCase {
  constructor(@Inject(ORGANIZATION_REPOSITORY) private readonly organizationRepository: OrganizationRepositoryPort) {}

  execute(input: CreateOrganizationInput): Promise<Organization> {
    return this.organizationRepository.create({ name: input.name, document: input.document ?? null });
  }
}
