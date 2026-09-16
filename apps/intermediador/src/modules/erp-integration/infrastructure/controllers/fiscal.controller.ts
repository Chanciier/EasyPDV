import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { TerminalApiKeyGuard } from "../../../organizations/infrastructure/guards/terminal-api-key.guard.js";
import {
  CurrentTerminal,
  type AuthenticatedTerminal,
} from "../../../organizations/infrastructure/decorators/current-terminal.decorator.js";
import { GetFiscalStatusUseCase } from "../../application/use-cases/get-fiscal-status.use-case.js";
import { IssueFiscalReceiptManuallyUseCase } from "../../application/use-cases/issue-fiscal-receipt-manually.use-case.js";
import { RetryFiscalDocumentUseCase } from "../../application/use-cases/retry-fiscal-document.use-case.js";
import { ReissueFiscalDocumentUseCase } from "../../application/use-cases/reissue-fiscal-document.use-case.js";

/**
 * Chamado pelo PDV local (não um dashboard de admin, por isso guardado
 * como POST /sync — TerminalApiKeyGuard, mesmo padrão do Sprint 10) pra
 * espelhar o status fiscal de uma venda no seu FiscalDocument local (SQLite).
 *
 * Achado H1 da auditoria de segurança (2026-09-14) corrigido: `get`/`retry`
 * não usavam `@CurrentTerminal()` — um terminal de QUALQUER organização
 * (com apiKey válida seja de qual for) conseguia consultar/reenviar a NFC-e
 * de uma venda de OUTRA organização, sabendo o `saleId`. Agora os três
 * endpoints escopam por `terminal.organizationId`, mesmo padrão de `issue`.
 */
@Controller("fiscal")
@UseGuards(TerminalApiKeyGuard)
export class FiscalController {
  constructor(
    private readonly getFiscalStatusUseCase: GetFiscalStatusUseCase,
    private readonly issueFiscalReceiptManuallyUseCase: IssueFiscalReceiptManuallyUseCase,
    private readonly retryFiscalDocumentUseCase: RetryFiscalDocumentUseCase,
    private readonly reissueFiscalDocumentUseCase: ReissueFiscalDocumentUseCase,
  ) {}

  @Get("sale/:saleId")
  get(@Param("saleId") saleId: string, @CurrentTerminal() terminal: AuthenticatedTerminal) {
    return this.getFiscalStatusUseCase.execute(terminal.organizationId, saleId);
  }

  @Post("sale/:saleId/issue")
  issue(@Param("saleId") saleId: string, @CurrentTerminal() terminal: AuthenticatedTerminal) {
    return this.issueFiscalReceiptManuallyUseCase.execute(terminal.organizationId, saleId);
  }

  @Post("sale/:saleId/retry")
  retry(@Param("saleId") saleId: string, @CurrentTerminal() terminal: AuthenticatedTerminal) {
    return this.retryFiscalDocumentUseCase.execute(terminal.organizationId, saleId);
  }

  @Post("sale/:saleId/reissue")
  reissue(@Param("saleId") saleId: string, @CurrentTerminal() terminal: AuthenticatedTerminal) {
    return this.reissueFiscalDocumentUseCase.execute(terminal.organizationId, saleId);
  }
}
