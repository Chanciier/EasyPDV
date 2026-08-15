import { Inject, Injectable } from "@nestjs/common";
import type { RegisterCashMovementInput } from "@easypdv/shared-validation";
import { CashSessionNotFoundError, CashSessionNotOpenError } from "../../domain/errors.js";
import {
  CASH_REPOSITORY,
  type CashMovementRecord,
  type CashRepositoryPort,
} from "../ports/cash-repository.port.js";
import {
  AUDIT_LOG_REPOSITORY,
  type AuditLogRepositoryPort,
} from "../../../audit/application/ports/audit-log-repository.port.js";

@Injectable()
export class RegisterCashMovementUseCase {
  constructor(
    @Inject(CASH_REPOSITORY) private readonly cashRepository: CashRepositoryPort,
    @Inject(AUDIT_LOG_REPOSITORY) private readonly auditLogRepository: AuditLogRepositoryPort,
  ) {}

  async execute(
    sessionId: string,
    input: RegisterCashMovementInput,
    authorizedByUserId: string | null,
  ): Promise<CashMovementRecord> {
    const session = await this.cashRepository.findSessionById(sessionId);
    if (!session) {
      throw new CashSessionNotFoundError(sessionId);
    }
    if (!session.isOpen) {
      throw new CashSessionNotOpenError(sessionId);
    }
    const movement = await this.cashRepository.registerMovement({
      cashSessionId: sessionId,
      type: input.type,
      amount: input.amount,
      reason: input.reason ?? null,
      authorizedByUserId,
    });
    await this.auditLogRepository.record({
      userId: authorizedByUserId,
      action: "cash_movement.registered",
      entityType: "cash_session",
      entityId: sessionId,
      metadata: { type: input.type, amount: input.amount, reason: input.reason ?? null },
    });
    return movement;
  }
}
