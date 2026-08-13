import { Inject, Injectable } from "@nestjs/common";
import { CashSessionNotFoundError, CashSessionNotOpenError } from "../../domain/errors.js";
import type { CashSession } from "../../domain/entities/cash-session.entity.js";
import { CASH_REPOSITORY, type CashRepositoryPort } from "../ports/cash-repository.port.js";

/**
 * expectedAmount = abertura + suprimentos - sangrias (+ vendas em dinheiro,
 * a partir da Sprint 5, quando Payment existir). Ver docs/DATABASE.md.
 */
@Injectable()
export class CloseCashSessionUseCase {
  constructor(@Inject(CASH_REPOSITORY) private readonly cashRepository: CashRepositoryPort) {}

  async execute(sessionId: string, closingAmount: number): Promise<CashSession> {
    const session = await this.cashRepository.findSessionById(sessionId);
    if (!session) {
      throw new CashSessionNotFoundError(sessionId);
    }
    if (!session.isOpen) {
      throw new CashSessionNotOpenError(sessionId);
    }

    const movements = await this.cashRepository.sumMovements(sessionId);
    const expectedAmount = session.openingAmount + movements.suprimento - movements.sangria + movements.ajuste;

    return this.cashRepository.closeSession(sessionId, closingAmount, expectedAmount);
  }
}
