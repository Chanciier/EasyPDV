import { Inject, Injectable } from "@nestjs/common";
import type { RegisterCashMovementInput } from "@easypdv/shared-validation";
import { CashSessionNotFoundError, CashSessionNotOpenError } from "../../domain/errors.js";
import {
  CASH_REPOSITORY,
  type CashMovementRecord,
  type CashRepositoryPort,
} from "../ports/cash-repository.port.js";

@Injectable()
export class RegisterCashMovementUseCase {
  constructor(@Inject(CASH_REPOSITORY) private readonly cashRepository: CashRepositoryPort) {}

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
    return this.cashRepository.registerMovement({
      cashSessionId: sessionId,
      type: input.type,
      amount: input.amount,
      reason: input.reason ?? null,
      authorizedByUserId,
    });
  }
}
