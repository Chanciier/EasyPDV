import { Controller, Get, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { ConnectBlingUseCase } from "../../application/use-cases/connect-bling.use-case.js";
import { HandleBlingCallbackUseCase } from "../../application/use-cases/handle-bling-callback.use-case.js";
import { GetBlingConnectionStatusUseCase } from "../../application/use-cases/get-bling-connection-status.use-case.js";

/**
 * Sem autenticação por enquanto — mesmo risco aberto desde a Sprint 6
 * (não existe auth de operador nesta API ainda). Ver docs/ERROR-HANDLING.md.
 */
@Controller("integrations")
export class ErpIntegrationController {
  constructor(
    private readonly connectBlingUseCase: ConnectBlingUseCase,
    private readonly handleBlingCallbackUseCase: HandleBlingCallbackUseCase,
    private readonly getBlingConnectionStatusUseCase: GetBlingConnectionStatusUseCase,
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
}
