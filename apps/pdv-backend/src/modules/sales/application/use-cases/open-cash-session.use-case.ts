import { Inject, Injectable } from "@nestjs/common";
import type { OpenCashSessionInput } from "@easypdv/shared-validation";
import { CashRegisterAlreadyOpenError, CashRegisterNotFoundError } from "../../domain/errors.js";
import type { CashSession } from "../../domain/entities/cash-session.entity.js";
import { CASH_REPOSITORY, type CashRepositoryPort } from "../ports/cash-repository.port.js";
import {
  AUDIT_LOG_REPOSITORY,
  type AuditLogRepositoryPort,
} from "../../../audit/application/ports/audit-log-repository.port.js";

@Injectable()
export class OpenCashSessionUseCase {
  constructor(
    @Inject(CASH_REPOSITORY) private readonly cashRepository: CashRepositoryPort,
    @Inject(AUDIT_LOG_REPOSITORY) private readonly auditLogRepository: AuditLogRepositoryPort,
  ) {}

  async execute(input: OpenCashSessionInput, operatorUserId: string): Promise<CashSession> {
    const register = await this.cashRepository.findRegisterById(input.cashRegisterId);
    if (!register) {
      throw new CashRegisterNotFoundError(input.cashRegisterId);
    }
    const alreadyOpen = await this.cashRepository.findOpenSessionByRegister(input.cashRegisterId);
    if (alreadyOpen) {
      throw new CashRegisterAlreadyOpenError(input.cashRegisterId);
    }
    const session = await this.cashRepository.openSession({
      cashRegisterId: input.cashRegisterId,
      operatorUserId,
      openingAmount: input.openingAmount,
      terminalId: input.terminalId ?? null,
    });
    await this.auditLogRepository.record({
      userId: operatorUserId,
      action: "cash_session.opened",
      entityType: "cash_session",
      entityId: session.id,
      metadata: { openingAmount: input.openingAmount },
    });
    return session;
  }
}
