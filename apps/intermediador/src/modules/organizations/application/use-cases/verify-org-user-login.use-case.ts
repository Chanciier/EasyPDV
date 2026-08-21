import { Inject, Injectable } from "@nestjs/common";
import { InvalidOrgUserCredentialsError } from "../../domain/errors.js";
import type { OrgUser } from "../../domain/entities/org-user.entity.js";
import { PASSWORD_HASHER, type PasswordHasherPort } from "../ports/password-hasher.port.js";
import { ORG_USER_REPOSITORY, type OrgUserRepositoryPort } from "../ports/org-user-repository.port.js";

/**
 * Hash bcrypt fixo (nunca corresponde a nenhuma senha real) — comparado
 * quando o e-mail não existe, só pra gastar o mesmo tempo de CPU que um
 * bcrypt.compare de verdade gastaria. Sem isso, "e-mail não existe" responde
 * bem mais rápido que "senha errada", o que por si só já vaza se o e-mail
 * existe (timing oracle) mesmo com a mensagem de erro idêntica.
 */
const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO0dIbHo9NwHkAHYbUnn2rUdeIsUXhu0G";

/**
 * `POST /organizations/:id/users/verify-login` (login único entre terminais,
 * 2026-08-21) — chamado pelo pdv-backend de qualquer terminal, autenticado
 * como TERMINAL (TerminalApiKeyGuard), não como pessoa: quem pergunta já é
 * confiável, a pessoa por trás é que ainda não foi confirmada. Devolve o
 * OrgUser (sem token — cada terminal emite o próprio JWT local) se as
 * credenciais forem válidas E o usuário estiver ativo; senão, sempre o MESMO
 * erro (InvalidOrgUserCredentialsError) pros três casos (e-mail não existe,
 * senha errada, usuário inativo) — nunca vaza qual dos três foi.
 */
@Injectable()
export class VerifyOrgUserLoginUseCase {
  constructor(
    @Inject(ORG_USER_REPOSITORY) private readonly orgUserRepository: OrgUserRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(organizationId: string, email: string, password: string): Promise<OrgUser> {
    const user = await this.orgUserRepository.findByOrganizationAndEmail(organizationId, email);
    const passwordMatches = await this.passwordHasher.compare(password, user?.passwordHash ?? DUMMY_HASH);

    if (!user || !passwordMatches || !user.active) {
      throw new InvalidOrgUserCredentialsError();
    }
    return user;
  }
}
