import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { randomBytes } from "node:crypto";
import { InvalidRefreshTokenError } from "../../domain/errors.js";
import type { AuthTokens } from "@easypdv/shared-types";
import { AUTH_SESSION_REPOSITORY, type AuthSessionRepositoryPort } from "../ports/auth-session-repository.port.js";
import { PASSWORD_HASHER, type PasswordHasherPort } from "../ports/password-hasher.port.js";
import { USER_REPOSITORY, type UserRepositoryPort } from "../ports/user-repository.port.js";

/** Refresh token rotacionado a cada uso — a sessão antiga é revogada. Ver docs/BACKEND.md. */
@Injectable()
export class RefreshTokenUseCase {
  constructor(
    @Inject(AUTH_SESSION_REPOSITORY) private readonly authSessionRepository: AuthSessionRepositoryPort,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasherPort,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async execute(refreshToken: string): Promise<AuthTokens> {
    const [sessionId, secret] = refreshToken.split(".");
    if (!sessionId || !secret) {
      throw new InvalidRefreshTokenError();
    }

    const session = await this.authSessionRepository.findById(sessionId);
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new InvalidRefreshTokenError();
    }

    const matches = await this.passwordHasher.compare(secret, session.refreshTokenHash);
    if (!matches) {
      throw new InvalidRefreshTokenError();
    }

    const user = await this.userRepository.findById(session.userId);
    if (!user || !user.active) {
      throw new InvalidRefreshTokenError();
    }

    await this.authSessionRepository.revoke(session.id);

    const accessToken = this.jwtService.sign({ sub: user.id, role: user.role });
    const newSecret = randomBytes(32).toString("base64url");
    const refreshTokenHash = await this.passwordHasher.hash(newSecret);
    const refreshTtlDays = Number(this.configService.get("JWT_REFRESH_EXPIRES_DAYS") ?? 30);
    const expiresAt = new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000);

    const newSession = await this.authSessionRepository.create({
      userId: user.id,
      refreshTokenHash,
      terminalId: null,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken: `${newSession.id}.${newSecret}`,
      expiresAt: expiresAt.toISOString(),
    };
  }
}
