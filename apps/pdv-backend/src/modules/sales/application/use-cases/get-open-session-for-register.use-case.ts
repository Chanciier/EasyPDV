import { Inject, Injectable } from "@nestjs/common";
import type { CashSession } from "../../domain/entities/cash-session.entity.js";
import { CASH_REPOSITORY, type CashRepositoryPort } from "../ports/cash-repository.port.js";

/**
 * Ação de admin (Caixa, 2026-09-16, achado real reportado pelo usuário) —
 * "Abrir caixa" só enxerga a sessão do PRÓPRIO operador
 * (`GetCurrentCashSessionUseCase`); quando o caixa já está aberto por OUTRO
 * login (comum: turno anterior, ou troca de conta), o operador atual não
 * tinha como ver nem fechar essa sessão pela tela — precisava logar com a
 * conta antiga de volta. `null` = caixa realmente livre, não é erro.
 */
@Injectable()
export class GetOpenSessionForRegisterUseCase {
  constructor(@Inject(CASH_REPOSITORY) private readonly cashRepository: CashRepositoryPort) {}

  execute(cashRegisterId: string): Promise<CashSession | null> {
    return this.cashRepository.findOpenSessionByRegister(cashRegisterId);
  }
}
