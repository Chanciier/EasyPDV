import { Inject, Injectable } from "@nestjs/common";
import type { UserRole } from "@easypdv/shared-types";
import { ForbiddenRoleChangeError, UserNotFoundError } from "../../domain/errors.js";
import type { User } from "../../domain/entities/user.entity.js";
import { USER_REPOSITORY, type UserRepositoryPort } from "../ports/user-repository.port.js";
import {
  USER_VERIFICATION_GATEWAY,
  type UserVerificationGatewayPort,
} from "../ports/user-verification-gateway.port.js";
import {
  AUDIT_LOG_REPOSITORY,
  type AuditLogRepositoryPort,
} from "../../../audit/application/ports/audit-log-repository.port.js";

@Injectable()
export class UpdateUserRoleUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepositoryPort,
    @Inject(AUDIT_LOG_REPOSITORY) private readonly auditLogRepository: AuditLogRepositoryPort,
    @Inject(USER_VERIFICATION_GATEWAY) private readonly userVerificationGateway: UserVerificationGatewayPort,
  ) {}

  /**
   * SEG-15 (2026-10-22): `proprietario` passa em todo `@Roles`, então é a
   * única elevação acima de administrador — só um proprietário pode dar ou
   * tirar esse papel, e ninguém altera o próprio papel. `actorRole` opcional
   * só para não quebrar outro chamador; sem ele, trata como não-proprietário.
   */
  async execute(userId: string, role: UserRole, actorUserId: string | null, actorRole?: string): Promise<User> {
    if (actorUserId && actorUserId === userId) {
      throw new ForbiddenRoleChangeError("Você não pode alterar o seu próprio papel.");
    }
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UserNotFoundError(userId);
    }
    if (actorRole !== "proprietario" && (role === "proprietario" || user.role === "proprietario")) {
      throw new ForbiddenRoleChangeError("Só o proprietário pode dar ou tirar o papel de proprietário.");
    }

    // Login único entre terminais (2026-08-21): só escreve no Intermediador
    // quando este usuário É central (orgUserId presente) — usuário local
    // pré-migração (ou o admin de fallback do bootstrap) segue editável só
    // localmente, reconciliação com o Intermediador é decisão manual, não
    // automática (ver Claude/Projetos/EasyPDV/Decisões e Riscos Abertos.md).
    if (user.orgUserId) {
      await this.userVerificationGateway.updateCentralUserRole(user.orgUserId, role);
    }

    const updated = await this.userRepository.updateRole(userId, role);
    await this.auditLogRepository.record({
      userId: actorUserId,
      action: "user.role_changed",
      entityType: "user",
      entityId: userId,
      metadata: { fromRole: user.role, toRole: role },
    });
    return updated;
  }
}
