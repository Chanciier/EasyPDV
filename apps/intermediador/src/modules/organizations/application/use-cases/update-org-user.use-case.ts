import { Inject, Injectable } from "@nestjs/common";
import type { UpdateOrgUserInput } from "@easypdv/shared-validation";
import { OrgUserNotFoundError } from "../../domain/errors.js";
import type { OrgUser } from "../../domain/entities/org-user.entity.js";
import { ORG_USER_REPOSITORY, type OrgUserRepositoryPort } from "../ports/org-user-repository.port.js";

/**
 * Achado C5 da auditoria de segurança (2026-09-14) corrigido: antes buscava
 * e atualizava só por `id`, sem checar `organizationId` — um terminal de
 * QUALQUER organização conseguia trocar role/status (inclusive promover a
 * `proprietario`) de usuário de OUTRA organização. Agora usa as variantes
 * escopadas do repositório.
 */
@Injectable()
export class UpdateOrgUserUseCase {
  constructor(@Inject(ORG_USER_REPOSITORY) private readonly orgUserRepository: OrgUserRepositoryPort) {}

  async execute(organizationId: string, id: string, input: UpdateOrgUserInput): Promise<OrgUser> {
    const existing = await this.orgUserRepository.findByIdInOrganization(organizationId, id);
    if (!existing) {
      throw new OrgUserNotFoundError(id);
    }
    return this.orgUserRepository.updateInOrganization(organizationId, id, { role: input.role, active: input.active });
  }
}
