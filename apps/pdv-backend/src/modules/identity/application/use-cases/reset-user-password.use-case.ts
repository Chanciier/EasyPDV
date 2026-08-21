import { Inject, Injectable } from "@nestjs/common";
import { UserNotFoundError } from "../../domain/errors.js";
import type { User } from "../../domain/entities/user.entity.js";
import { PASSWORD_HASHER, type PasswordHasherPort } from "../ports/password-hasher.port.js";
import { USER_REPOSITORY, type UserRepositoryPort } from "../ports/user-repository.port.js";
import {
  USER_VERIFICATION_GATEWAY,
  type UserVerificationGatewayPort,
} from "../ports/user-verification-gateway.port.js";
import {
  AUDIT_LOG_REPOSITORY,
  type AuditLogRepositoryPort,
} from "../../../audit/application/ports/audit-log-repository.port.js";

/**
 * Reset por admin (`PATCH /users/:id/reset-password`, 2026-08-21) — admin
 * troca a senha de OUTRO usuário sem precisar saber a atual (digita a nova
 * direto na tela — sem infraestrutura de e-mail, não tem como mandar senha
 * temporária). Sempre seta `mustChangePassword: true` — a pessoa é obrigada
 * a escolher a própria senha no próximo login, nunca continua usando a que o
 * admin digitou. Mesmo padrão central-primeiro de ChangePasswordUseCase.
 */
@Injectable()
export class ResetUserPasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasherPort,
    @Inject(USER_VERIFICATION_GATEWAY) private readonly userVerificationGateway: UserVerificationGatewayPort,
    @Inject(AUDIT_LOG_REPOSITORY) private readonly auditLogRepository: AuditLogRepositoryPort,
  ) {}

  async execute(targetUserId: string, newPassword: string, actorUserId: string | null): Promise<User> {
    const user = await this.userRepository.findById(targetUserId);
    if (!user) {
      throw new UserNotFoundError(targetUserId);
    }

    if (user.orgUserId) {
      await this.userVerificationGateway.changePassword(user.orgUserId, newPassword);
    }
    const passwordHash = await this.passwordHasher.hash(newPassword);
    const updated = await this.userRepository.updatePasswordHash(user.id, passwordHash, true);

    await this.auditLogRepository.record({
      userId: actorUserId,
      action: "user.password_reset",
      entityType: "user",
      entityId: user.id,
      metadata: null,
    });
    return updated;
  }
}
