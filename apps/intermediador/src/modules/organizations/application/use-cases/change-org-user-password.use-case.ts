import { Inject, Injectable } from "@nestjs/common";
import { OrgUserNotFoundError } from "../../domain/errors.js";
import type { OrgUser } from "../../domain/entities/org-user.entity.js";
import { PASSWORD_HASHER, type PasswordHasherPort } from "../ports/password-hasher.port.js";
import { ORG_USER_REPOSITORY, type OrgUserRepositoryPort } from "../ports/org-user-repository.port.js";

/**
 * `PATCH /organizations/:id/users/:userId/password` (troca/reset de senha,
 * 2026-08-21) — chamado pelo pdv-backend, central primeiro.
 *
 * Achado C4 da auditoria de segurança (2026-09-14) corrigido: antes buscava
 * e atualizava só por `id`, sem checar se o usuário alvo pertencia à
 * `organizationId` de quem pediu — um terminal de QUALQUER organização
 * conseguia resetar a senha de um usuário de OUTRA. Agora usa as variantes
 * escopadas do repositório (`findByIdInOrganization`/`updatePasswordInOrganization`).
 */
@Injectable()
export class ChangeOrgUserPasswordUseCase {
  constructor(
    @Inject(ORG_USER_REPOSITORY) private readonly orgUserRepository: OrgUserRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(organizationId: string, id: string, newPassword: string): Promise<OrgUser> {
    const existing = await this.orgUserRepository.findByIdInOrganization(organizationId, id);
    if (!existing) {
      throw new OrgUserNotFoundError(id);
    }
    const passwordHash = await this.passwordHasher.hash(newPassword);
    return this.orgUserRepository.updatePasswordInOrganization(organizationId, id, passwordHash);
  }
}
