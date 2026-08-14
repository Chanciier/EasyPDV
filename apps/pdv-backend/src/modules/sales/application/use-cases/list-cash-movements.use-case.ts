import { Inject, Injectable } from "@nestjs/common";
import { CASH_REPOSITORY, type CashMovementRecord, type CashRepositoryPort } from "../ports/cash-repository.port.js";

/** Tela de Caixa (Sprint 9). */
@Injectable()
export class ListCashMovementsUseCase {
  constructor(@Inject(CASH_REPOSITORY) private readonly cashRepository: CashRepositoryPort) {}

  execute(cashSessionId: string): Promise<CashMovementRecord[]> {
    return this.cashRepository.listMovements(cashSessionId);
  }
}
