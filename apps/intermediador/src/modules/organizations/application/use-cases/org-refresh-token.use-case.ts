import { Inject, Injectable } from "@nestjs/common";
import type { AuthTokens } from "@easypdv/shared-types";
import { InvalidOrgRefreshTokenError } from "../../domain/errors.js";
import {
  ORG_AUTH_SESSION_REPOSITORY,
  type OrgAuthSessionRepositoryPort,
} from "../ports/org-auth-session-repository.port.js";
import { ORG_USER_REPOSITORY, type OrgUserRepositoryPort } from "../ports/org-user-repository.port.js";
import { PASSWORD_HASHER, type PasswordHasherPort } from "../ports/password-hasher.port.js";
import { OrgTokenIssuerService } from "../services/org-token-issuer.service.js";

/**
 * Refresh token rotacionado a cada uso — a sessão antiga é revogada e uma
 * nova é criada (mesmo padrão do RefreshTokenUseCase do pdv-backend). Aqui
 * não existe recheck periódico contra um "central" — este JÁ é o central;
 * só confere se o OrgUser continua ativo a cada chamada (consulta local,
 * sem round-trip de rede nenhum, diferente do pdv-backend que reconsulta o
 * Intermediador por HTTP).
 */
@Injectable()
export class OrgRefreshTokenUseCase {
  constructor(
    @Inject(ORG_AUTH_SESSION_REPOSITORY) private readonly orgAuthSessionRepository: OrgAuthSessionRepositoryPort,
    @Inject(ORG_USER_REPOSITORY) private readonly orgUserRepository: OrgUserRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasherPort,
    private readonly tokenIssuer: OrgTokenIssuerService,
  ) {}

  async execute(refreshToken: string): Promise<AuthTokens> {
    const [sessionId, secret] = refreshToken.split(".");
    if (!sessionId || !secret) {
      throw new InvalidOrgRefreshTokenError();
    }

    const session = await this.orgAuthSessionRepository.findById(sessionId);
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new InvalidOrgRefreshTokenError();
    }

    const matches = await this.passwordHasher.compare(secret, session.refreshTokenHash);
    if (!matches) {
      throw new InvalidOrgRefreshTokenError();
    }

    const user = await this.orgUserRepository.findById(session.orgUserId);
    if (!user || !user.active) {
      throw new InvalidOrgRefreshTokenError();
    }

    await this.orgAuthSessionRepository.revoke(session.id);

    const issued = await this.tokenIssuer.issue({
      sub: user.id,
      organizationId: user.organizationId,
      role: user.role,
    });

    const newSession = await this.orgAuthSessionRepository.create({
      orgUserId: user.id,
      refreshTokenHash: issued.refreshTokenHash,
      expiresAt: issued.expiresAt,
    });

    return {
      accessToken: issued.accessToken,
      refreshToken: `${newSession.id}.${issued.refreshToken}`,
      expiresAt: issued.expiresAt.toISOString(),
    };
  }
}
