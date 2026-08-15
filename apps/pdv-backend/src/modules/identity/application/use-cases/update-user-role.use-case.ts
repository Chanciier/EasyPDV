import { Inject, Injectable } from "@nestjs/common";
import type { UserRole } from "@easypdv/shared-types";
import { UserNotFoundError } from "../../domain/errors.js";
import type { User } from "../../domain/entities/user.entity.js";
import { USER_REPOSITORY, type UserRepositoryPort } from "../ports/user-repository.port.js";
import {
  AUDIT_LOG_REPOSITORY,
  type AuditLogRepositoryPort,
} from "../../../audit/application/ports/audit-log-repository.port.js";

@Injectable()
export class UpdateUserRoleUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepositoryPort,
    @Inject(AUDIT_LOG_REPOSITORY) private readonly auditLogRepository: AuditLogRepositoryPort,
  ) {}

  async execute(userId: string, role: UserRole, actorUserId: string | null): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UserNotFoundError(userId);
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
