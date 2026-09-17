import { Inject, Injectable } from "@nestjs/common";
import { InvalidRefreshTokenError } from "../../domain/errors.js";
import type { AuthTokens } from "@easypdv/shared-types";
import { AUTH_SESSION_REPOSITORY, type AuthSessionRepositoryPort } from "../ports/auth-session-repository.port.js";
import { PASSWORD_HASHER, type PasswordHasherPort } from "../ports/password-hasher.port.js";
import { USER_REPOSITORY, type UserRepositoryPort } from "../ports/user-repository.port.js";
import {
  USER_VERIFICATION_GATEWAY,
  type UserVerificationGatewayPort,
} from "../ports/user-verification-gateway.port.js";
import { TokenIssuerService } from "../services/token-issuer.service.js";

const CENTRAL_RECHECK_INTERVAL_MS = 60 * 60 * 1000;

/** Refresh token rotacionado a cada uso — a sessão antiga é revogada. Ver docs/BACKEND.md. */
@Injectable()
export class RefreshTokenUseCase {
  constructor(
    @Inject(AUTH_SESSION_REPOSITORY) private readonly authSessionRepository: AuthSessionRepositoryPort,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasherPort,
    @Inject(USER_VERIFICATION_GATEWAY) private readonly userVerificationGateway: UserVerificationGatewayPort,
    private readonly tokenIssuer: TokenIssuerService,
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

    // Login único entre terminais (2026-08-21) — um usuário desativado ou
    // rebaixado centralmente não deve continuar ativo neste terminal só
    // porque o refresh token dele ainda não expirou (até 30 dias). Só
    // reconsulta o Intermediador quando a última confirmação passou de ~1h
    // (não a cada refresh) — `null` (usuário puramente local, ou
    // Intermediador fora do ar) segue sem bloquear, mesmo padrão de
    // fallback do login.
    const needsRecheck =
      !user.lastVerifiedCentrallyAt ||
      Date.now() - user.lastVerifiedCentrallyAt.getTime() > CENTRAL_RECHECK_INTERVAL_MS;
    if (needsRecheck) {
      const stillActive = await this.userVerificationGateway.checkStillActive(user.email);
      if (stillActive === false) {
        throw new InvalidRefreshTokenError();
      }
      if (stillActive === true) {
        await this.userRepository.touchLastVerifiedCentrally(user.id);
      }
    }

    await this.authSessionRepository.revoke(session.id);

    const issued = await this.tokenIssuer.issue({ sub: user.id, role: user.role });

    const newSession = await this.authSessionRepository.create({
      userId: user.id,
      refreshTokenHash: issued.refreshTokenHash,
      terminalId: null,
      expiresAt: issued.expiresAt,
    });

    return {
      accessToken: issued.accessToken,
      refreshToken: `${newSession.id}.${issued.refreshToken}`,
      expiresAt: issued.expiresAt.toISOString(),
    };
  }
}
