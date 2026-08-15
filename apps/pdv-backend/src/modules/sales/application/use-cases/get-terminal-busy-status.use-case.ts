import { Inject, Injectable } from "@nestjs/common";
import { CASH_REPOSITORY, type CashRepositoryPort } from "../ports/cash-repository.port.js";

/**
 * Consumido pelo Electron (main process, via ProvisioningController — sem
 * JWT de operador disponível ali) pra decidir se pode aplicar uma
 * atualização baixada: nunca no meio de uma venda. "Ocupado" aqui é
 * qualquer sessão de caixa aberta, de qualquer operador — não o escopo por
 * operador de GetCurrentCashSessionUseCase. Ver docs/ELECTRON.md.
 */
@Injectable()
export class GetTerminalBusyStatusUseCase {
  constructor(@Inject(CASH_REPOSITORY) private readonly cashRepository: CashRepositoryPort) {}

  async execute(): Promise<{ hasOpenCashSession: boolean }> {
    const session = await this.cashRepository.findAnyOpenSession();
    return { hasOpenCashSession: session !== null };
  }
}
