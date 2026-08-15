import { Inject, Injectable } from "@nestjs/common";
import { CashSessionNotFoundError, CashSessionNotOpenError } from "../../domain/errors.js";
import type { CashSession } from "../../domain/entities/cash-session.entity.js";
import { CASH_REPOSITORY, type CashRepositoryPort } from "../ports/cash-repository.port.js";
import { SALE_REPOSITORY, type SaleRepositoryPort } from "../ports/sale-repository.port.js";
import {
  AUDIT_LOG_REPOSITORY,
  type AuditLogRepositoryPort,
} from "../../../audit/application/ports/audit-log-repository.port.js";

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
    @Inject(AUDIT_LOG_REPOSITORY) private readonly auditLogRepository: AuditLogRepositoryPort,
  ) {}

  async execute(sessionId: string, closingAmount: number, actorUserId: string | null): Promise<CashSession> {
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

    const closed = await this.cashRepository.closeSession(sessionId, closingAmount, expectedAmount);
    await this.auditLogRepository.record({
      userId: actorUserId,
      action: "cash_session.closed",
      entityType: "cash_session",
      entityId: sessionId,
      metadata: { closingAmount, expectedAmount, divergence: closingAmount - expectedAmount },
    });
    return closed;
  }
}
