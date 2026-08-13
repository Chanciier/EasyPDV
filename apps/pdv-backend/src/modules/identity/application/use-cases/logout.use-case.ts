import { Inject, Injectable } from "@nestjs/common";
import { AUTH_SESSION_REPOSITORY, type AuthSessionRepositoryPort } from "../ports/auth-session-repository.port.js";

@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(AUTH_SESSION_REPOSITORY) private readonly authSessionRepository: AuthSessionRepositoryPort,
  ) {}

  async execute(refreshToken: string): Promise<void> {
    const [sessionId] = refreshToken.split(".");
    if (!sessionId) {
      return;
    }
    const session = await this.authSessionRepository.findById(sessionId);
    if (session && !session.revokedAt) {
      await this.authSessionRepository.revoke(sessionId);
    }
  }
}
