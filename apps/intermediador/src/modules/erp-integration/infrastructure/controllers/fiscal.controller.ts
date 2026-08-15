import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { TerminalApiKeyGuard } from "../../../organizations/infrastructure/guards/terminal-api-key.guard.js";
import { GetFiscalStatusUseCase } from "../../application/use-cases/get-fiscal-status.use-case.js";

/**
 * Chamado pelo PDV local (não um dashboard de admin, por isso guardado
 * como POST /sync — TerminalApiKeyGuard, mesmo padrão do Sprint 10) pra
 * espelhar o status fiscal de uma venda no seu FiscalDocument local (SQLite).
 */
@Controller("fiscal")
@UseGuards(TerminalApiKeyGuard)
export class FiscalController {
  constructor(private readonly getFiscalStatusUseCase: GetFiscalStatusUseCase) {}

  @Get("sale/:saleId")
  get(@Param("saleId") saleId: string) {
    return this.getFiscalStatusUseCase.execute(saleId);
  }
}
