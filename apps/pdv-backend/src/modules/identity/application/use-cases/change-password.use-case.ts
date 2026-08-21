import { Inject, Injectable } from "@nestjs/common";
import { InvalidCredentialsError, UserNotFoundError } from "../../domain/errors.js";
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
 * Autoatendimento (`POST /auth/change-password`, 2026-08-21) — usuário logado
 * troca a PRÓPRIA senha, sabendo a atual. Mesmo padrão central-primeiro de
 * CreateUserUseCase/UpdateUserRoleUseCase: usuário central (`orgUserId`
 * presente) escreve no Intermediador primeiro, espelha local no sucesso;
 * usuário só local só muda localmente. Confirma a senha ATUAL com a mesma
 * lógica dual do LoginUseCase (central primeiro, cai pro hash local só se o
 * Intermediador estiver inalcançável) — nunca inventa um atalho novo aqui.
 */
@Injectable()
export class ChangePasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasherPort,
    @Inject(USER_VERIFICATION_GATEWAY) private readonly userVerificationGateway: UserVerificationGatewayPort,
    @Inject(AUDIT_LOG_REPOSITORY) private readonly auditLogRepository: AuditLogRepositoryPort,
  ) {}

  async execute(userId: string, currentPassword: string, newPassword: string): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UserNotFoundError(userId);
    }

    const currentPasswordValid = await this.verifyCurrentPassword(user, currentPassword);
    if (!currentPasswordValid) {
      throw new InvalidCredentialsError();
    }

    if (user.orgUserId) {
      await this.userVerificationGateway.changePassword(user.orgUserId, newPassword);
    }
    const passwordHash = await this.passwordHasher.hash(newPassword);
    const updated = await this.userRepository.updatePasswordHash(user.id, passwordHash, false);

    await this.auditLogRepository.record({
      userId: user.id,
      action: "user.password_changed",
      entityType: "user",
      entityId: user.id,
      metadata: null,
    });
    return updated;
  }

  private async verifyCurrentPassword(user: User, currentPassword: string): Promise<boolean> {
    if (user.orgUserId) {
      const central = await this.userVerificationGateway.verifyLogin(user.email, currentPassword);
      if (central.status === "invalid") return false;
      if (central.status === "verified") return true;
      // "unreachable" — cai pro espelho local, mesma lógica do LoginUseCase.
    }
    return this.passwordHasher.compare(currentPassword, user.passwordHash);
  }
}
