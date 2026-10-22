import { Inject, Injectable } from "@nestjs/common";
import { CashSessionNotFoundError } from "../../domain/errors.js";
import { assertCanOperateCashSession } from "../../domain/cash-session-access.js";
import { CASH_REPOSITORY, type CashRepositoryPort } from "../ports/cash-repository.port.js";
import { SALE_REPOSITORY, type SaleRepositoryPort } from "../ports/sale-repository.port.js";

/**
 * "Vendas em dinheiro" da tela Caixa (2026-10-22, PERF-08). Antes o frontend
 * baixava até 100 vendas completas e somava no cliente — lento e ERRADO a
 * partir da 101ª venda da sessão. Agora é a mesma soma em SQL que o
 * fechamento usa (`sumCashPayments`), então a tela bate com o fechamento.
 * Acesso: dono da sessão ou gerência (mesma regra de fechar/movimentar).
 */
@Injectable()
export class GetCashSalesTotalUseCase {
  constructor(
    @Inject(CASH_REPOSITORY) private readonly cashRepository: CashRepositoryPort,
    @Inject(SALE_REPOSITORY) private readonly saleRepository: SaleRepositoryPort,
  ) {}

  async execute(sessionId: string, actorUserId: string, actorRole: string): Promise<{ total: number }> {
    const session = await this.cashRepository.findSessionById(sessionId);
    if (!session) {
      throw new CashSessionNotFoundError(sessionId);
    }
    assertCanOperateCashSession(session, actorUserId, actorRole);
    const total = await this.saleRepository.sumCashPayments(sessionId);
    return { total };
  }
}
