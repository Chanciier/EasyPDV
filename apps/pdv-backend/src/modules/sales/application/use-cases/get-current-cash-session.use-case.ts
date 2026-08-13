import { Inject, Injectable } from "@nestjs/common";
import type { CashSession } from "../../domain/entities/cash-session.entity.js";
import { CASH_REPOSITORY, type CashRepositoryPort } from "../ports/cash-repository.port.js";

/** Retorna null (não é erro) se o operador não tem sessão aberta agora. */
@Injectable()
export class GetCurrentCashSessionUseCase {
  constructor(@Inject(CASH_REPOSITORY) private readonly cashRepository: CashRepositoryPort) {}

  execute(operatorUserId: string): Promise<CashSession | null> {
    return this.cashRepository.findOpenSessionByOperator(operatorUserId);
  }
}
