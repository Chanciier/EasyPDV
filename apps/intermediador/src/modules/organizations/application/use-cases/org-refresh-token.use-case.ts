import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { randomBytes } from "node:crypto";
import type { AuthTokens } from "@easypdv/shared-types";
import { InvalidOrgRefreshTokenError } from "../../domain/errors.js";
import {
  ORG_AUTH_SESSION_REPOSITORY,
  type OrgAuthSessionRepositoryPort,
} from "../ports/org-auth-session-repository.port.js";
import { ORG_USER_REPOSITORY, type OrgUserRepositoryPort } from "../ports/org-user-repository.port.js";
import { PASSWORD_HASHER, type PasswordHasherPort } from "../ports/password-hasher.port.js";

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
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
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

    const accessToken = this.jwtService.sign({ sub: user.id, organizationId: user.organizationId, role: user.role });
    const newSecret = randomBytes(32).toString("base64url");
    const refreshTokenHash = await this.passwordHasher.hash(newSecret);
    const refreshTtlDays = Number(this.configService.get("JWT_REFRESH_EXPIRES_DAYS") ?? 30);
    const expiresAt = new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000);

    const newSession = await this.orgAuthSessionRepository.create({
      orgUserId: user.id,
      refreshTokenHash,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken: `${newSession.id}.${newSecret}`,
      expiresAt: expiresAt.toISOString(),
    };
  }
}
