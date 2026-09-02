import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { TerminalApiKeyGuard } from "../../../organizations/infrastructure/guards/terminal-api-key.guard.js";
import {
  CurrentTerminal,
  type AuthenticatedTerminal,
} from "../../../organizations/infrastructure/decorators/current-terminal.decorator.js";
import { GetFiscalStatusUseCase } from "../../application/use-cases/get-fiscal-status.use-case.js";
import { IssueFiscalReceiptManuallyUseCase } from "../../application/use-cases/issue-fiscal-receipt-manually.use-case.js";
import { RetryFiscalDocumentUseCase } from "../../application/use-cases/retry-fiscal-document.use-case.js";

/**
 * Chamado pelo PDV local (não um dashboard de admin, por isso guardado
 * como POST /sync — TerminalApiKeyGuard, mesmo padrão do Sprint 10) pra
 * espelhar o status fiscal de uma venda no seu FiscalDocument local (SQLite).
 */
@Controller("fiscal")
@UseGuards(TerminalApiKeyGuard)
export class FiscalController {
  constructor(
    private readonly getFiscalStatusUseCase: GetFiscalStatusUseCase,
    private readonly issueFiscalReceiptManuallyUseCase: IssueFiscalReceiptManuallyUseCase,
    private readonly retryFiscalDocumentUseCase: RetryFiscalDocumentUseCase,
  ) {}

  @Get("sale/:saleId")
  get(@Param("saleId") saleId: string) {
    return this.getFiscalStatusUseCase.execute(saleId);
  }

  @Post("sale/:saleId/issue")
  issue(@Param("saleId") saleId: string, @CurrentTerminal() terminal: AuthenticatedTerminal) {
    return this.issueFiscalReceiptManuallyUseCase.execute(terminal.organizationId, saleId);
  }

  @Post("sale/:saleId/retry")
  retry(@Param("saleId") saleId: string) {
    return this.retryFiscalDocumentUseCase.execute(saleId);
  }
}
