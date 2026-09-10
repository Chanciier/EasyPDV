import { Inject, Injectable } from "@nestjs/common";
import {
  ORG_AUTH_SESSION_REPOSITORY,
  type OrgAuthSessionRepositoryPort,
} from "../ports/org-auth-session-repository.port.js";

@Injectable()
export class OrgLogoutUseCase {
  constructor(
    @Inject(ORG_AUTH_SESSION_REPOSITORY) private readonly orgAuthSessionRepository: OrgAuthSessionRepositoryPort,
  ) {}

  async execute(refreshToken: string): Promise<void> {
    const [sessionId] = refreshToken.split(".");
    if (!sessionId) {
      return;
    }
    const session = await this.orgAuthSessionRepository.findById(sessionId);
    if (session && !session.revokedAt) {
      await this.orgAuthSessionRepository.revoke(sessionId);
    }
  }
}
