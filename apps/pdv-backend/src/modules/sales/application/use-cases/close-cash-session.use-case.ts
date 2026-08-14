import { Inject, Injectable } from "@nestjs/common";
import { CashSessionNotFoundError, CashSessionNotOpenError } from "../../domain/errors.js";
import type { CashSession } from "../../domain/entities/cash-session.entity.js";
import { CASH_REPOSITORY, type CashRepositoryPort } from "../ports/cash-repository.port.js";
import { SALE_REPOSITORY, type SaleRepositoryPort } from "../ports/sale-repository.port.js";

/**
 * expectedAmount = abertura + suprimentos - sangrias + ajuste + vendas em
 * dinheiro. A soma de vendas em dinheiro ficou de fora até a Sprint 9 por
 * um gap real: o comentário original já previa isso "a partir da Sprint 5,
 * quando Payment existir", mas nunca foi implementado — corrigido aqui.
 * Ver docs/DATABASE.md.
 */
@Injectable()
export class CloseCashSessionUseCase {
  constructor(
    @Inject(CASH_REPOSITORY) private readonly cashRepository: CashRepositoryPort,
    @Inject(SALE_REPOSITORY) private readonly saleRepository: SaleRepositoryPort,
  ) {}

  async execute(sessionId: string, closingAmount: number): Promise<CashSession> {
    const session = await this.cashRepository.findSessionById(sessionId);
    if (!session) {
      throw new CashSessionNotFoundError(sessionId);
    }
    if (!session.isOpen) {
      throw new CashSessionNotOpenError(sessionId);
    }

    const [movements, cashSales] = await Promise.all([
      this.cashRepository.sumMovements(sessionId),
      this.saleRepository.sumCashPayments(sessionId),
    ]);
    const expectedAmount =
      session.openingAmount + movements.suprimento - movements.sangria + movements.ajuste + cashSales;

    return this.cashRepository.closeSession(sessionId, closingAmount, expectedAmount);
  }
}
