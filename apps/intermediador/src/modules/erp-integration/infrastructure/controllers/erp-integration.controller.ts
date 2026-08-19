import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { TerminalApiKeyGuard } from "../../../organizations/infrastructure/guards/terminal-api-key.guard.js";
import {
  CurrentTerminal,
  type AuthenticatedTerminal,
} from "../../../organizations/infrastructure/decorators/current-terminal.decorator.js";
import { ConnectBlingUseCase } from "../../application/use-cases/connect-bling.use-case.js";
import { HandleBlingCallbackUseCase } from "../../application/use-cases/handle-bling-callback.use-case.js";
import { GetBlingConnectionStatusUseCase } from "../../application/use-cases/get-bling-connection-status.use-case.js";
import { ListBlingProductsUseCase } from "../../application/use-cases/list-bling-products.use-case.js";

/**
 * Sem autenticação por enquanto — mesmo risco aberto desde a Sprint 6
 * (não existe auth de operador nesta API ainda). Ver docs/ERROR-HANDLING.md.
 * Exceção: `GET /products`, chamado pelo terminal (não uma tela de admin),
 * usa o mesmo TerminalApiKeyGuard de /fiscal e /sync.
 */
@Controller("integrations")
export class ErpIntegrationController {
  constructor(
    private readonly connectBlingUseCase: ConnectBlingUseCase,
    private readonly handleBlingCallbackUseCase: HandleBlingCallbackUseCase,
    private readonly getBlingConnectionStatusUseCase: GetBlingConnectionStatusUseCase,
    private readonly listBlingProductsUseCase: ListBlingProductsUseCase,
  ) {}

  @Get("bling/connect")
  connect(@Query("organizationId") organizationId: string, @Res() res: Response) {
    const url = this.connectBlingUseCase.execute(organizationId);
    res.redirect(url);
  }

  @Get("bling/callback")
  async callback(@Query("code") code: string, @Query("state") state: string) {
    const integration = await this.handleBlingCallbackUseCase.execute(code, state);
    return {
      connected: true,
      organizationId: integration.organizationId,
      expiresAt: integration.expiresAt,
    };
  }

  @Get("bling/status")
  status(@Query("organizationId") organizationId: string) {
    return this.getBlingConnectionStatusUseCase.execute(organizationId);
  }

  /**
   * Chamado pelo terminal (botão "Sincronizar com Bling" na tela Produtos, o
   * sync automático na ativação, e o poll periódico de estoque — ver
   * bling-stock-sync.worker.ts no pdv-backend), não uma tela de admin —
   * mesma fronteira de confiança de /fiscal e /sync. Escopado pela
   * organização do terminal autenticado (bug real corrigido: antes usava
   * findFirstActive, que pegava qualquer integração Bling ativa no
   * Intermediador inteiro, sem filtrar por organização — inofensivo enquanto
   * só existia 1 organização real, mas loja B ativando terminal puxaria o
   * catálogo da A). `since` (opcional, ISO) filtra pra só produtos alterados
   * a partir dessa data — ver ListBlingProductsUseCase.
   */
  @Get("bling/products")
  @UseGuards(TerminalApiKeyGuard)
  products(@CurrentTerminal() terminal: AuthenticatedTerminal, @Query("since") since?: string) {
    return this.listBlingProductsUseCase.execute(terminal.organizationId, since ? new Date(since) : undefined);
  }
}
