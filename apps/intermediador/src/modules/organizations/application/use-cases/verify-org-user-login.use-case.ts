import { Inject, Injectable } from "@nestjs/common";
import { InvalidOrgUserCredentialsError, OrgUserNotFoundError } from "../../domain/errors.js";
import type { OrgUser } from "../../domain/entities/org-user.entity.js";
import { PASSWORD_HASHER, type PasswordHasherPort } from "../ports/password-hasher.port.js";
import { ORG_USER_REPOSITORY, type OrgUserRepositoryPort } from "../ports/org-user-repository.port.js";

/** Bloqueio de conta por tentativa (2026-09-14) — camada independente do throttle por IP+e-mail (OrgLoginThrottlerGuard/VerifyLoginThrottlerGuard), protege contra ataque distribuído por vários IPs. */
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

/**
 * `POST /organizations/:id/users/verify-login` (login único entre terminais,
 * 2026-08-21) — chamado pelo pdv-backend de qualquer terminal, autenticado
 * como TERMINAL (TerminalApiKeyGuard), não como pessoa: quem pergunta já é
 * confiável, a pessoa por trás é que ainda não foi confirmada.
 *
 * **Distinção real entre 404 e 401, corrigida em 2026-08-21** (bug de
 * produção achado no mesmo dia): a versão original devolvia sempre 401 pros
 * três casos (e-mail não existe, senha errada, usuário inativo), pensando em
 * anti-enumeração — só que isso quebrou o login de usuário LOCAL
 * pré-existente (criado antes desta feature, nunca migrado pro Intermediador):
 * `LoginUseCase` (pdv-backend) trata 401 como "credenciais realmente
 * inválidas" e NUNCA cai pro fallback local nesse caso — de propósito, pra
 * não deixar uma senha local desatualizada continuar valendo depois de
 * trocada centralmente. Resultado: assim que o Intermediador ficava
 * alcançável, todo usuário local-only (nunca cadastrado aqui) ficava
 * permanentemente travado, mesmo com a senha local certa. Agora: e-mail que
 * NÃO EXISTE nesta organização devolve 404 (`OrgUserNotFoundError`) — o
 * gateway do pdv-backend já trata qualquer resposta não-401/não-ok como
 * "não deu pra confirmar", cai pro espelho local automaticamente, sem
 * precisar de nenhuma mudança no lado do terminal. Senha errada OU usuário
 * inativo continuam merged num único 401 (`InvalidOrgUserCredentialsError`)
 * — não vaza qual dos dois foi, mas isso já não protege muito: qualquer
 * terminal autenticado já consegue ver a lista completa de e-mails via
 * `GET /organizations/:id/users`, então 404-vs-401 não vaza nada que essa
 * rota já não exponha pro mesmo chamador.
 *
 * **Bloqueio de conta por tentativa (2026-09-14)** — pedido explícito do
 * usuário ("segurança e privacidade do sistema"), camada adicional além do
 * throttle por IP+e-mail já existente (que sozinho não pega um ataque
 * distribuído por vários IPs). `failedLoginAttempts`/`lockedUntil` vivem no
 * `OrgUser`, resetados a cada login bem-sucedido.
 */
@Injectable()
export class VerifyOrgUserLoginUseCase {
  constructor(
    @Inject(ORG_USER_REPOSITORY) private readonly orgUserRepository: OrgUserRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(organizationId: string, email: string, password: string): Promise<OrgUser> {
    const user = await this.orgUserRepository.findByOrganizationAndEmail(organizationId, email);
    if (!user) {
      throw new OrgUserNotFoundError(email);
    }

    // Conta bloqueada — mesmo erro genérico de senha errada, nunca revela o
    // bloqueio pra quem está tentando (só o dono de verdade sabe que errou
    // demais e precisa esperar; um atacante só vê "credenciais inválidas").
    if (user.isLocked) {
      throw new InvalidOrgUserCredentialsError();
    }

    const passwordMatches = await this.passwordHasher.compare(password, user.passwordHash);
    if (!passwordMatches || !user.active) {
      const attempts = user.failedLoginAttempts + 1;
      const lockedUntil = attempts >= LOCKOUT_THRESHOLD ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null;
      await this.orgUserRepository.update(user.id, { failedLoginAttempts: attempts, lockedUntil });
      throw new InvalidOrgUserCredentialsError();
    }

    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.orgUserRepository.update(user.id, { failedLoginAttempts: 0, lockedUntil: null });
    }
    return user;
  }
}
