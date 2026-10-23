import { Inject, Injectable } from "@nestjs/common";
import { AUTH_SESSION_REPOSITORY, type AuthSessionRepositoryPort } from "../ports/auth-session-repository.port.js";
import { PASSWORD_HASHER, type PasswordHasherPort } from "../ports/password-hasher.port.js";

/**
 * SEG-11 (2026-10-22): só revoga a sessão se o segredo do refresh token
 * bater com o hash gravado (mesmo padrão do RefreshTokenUseCase) — antes
 * bastava conhecer o `sessionId` (parte pública do token) para derrubar a
 * sessão de outra pessoa. Token que não confere vira no-op silencioso, como
 * já era para sessão inexistente.
 */
@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(AUTH_SESSION_REPOSITORY) private readonly authSessionRepository: AuthSessionRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(refreshToken: string): Promise<void> {
    const [sessionId, secret] = refreshToken.split(".");
    if (!sessionId || !secret) {
      return;
    }
    const session = await this.authSessionRepository.findById(sessionId);
    if (!session || session.revokedAt) {
      return;
    }
    const matches = await this.passwordHasher.compare(secret, session.refreshTokenHash);
    if (matches) {
      await this.authSessionRepository.revoke(sessionId);
    }
  }
}
