import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { TerminalApiKeyGuard } from "../../../organizations/infrastructure/guards/terminal-api-key.guard.js";
import { OrgJwtAuthGuard } from "../../../organizations/infrastructure/guards/org-jwt-auth.guard.js";
import {
  CurrentTerminal,
  type AuthenticatedTerminal,
} from "../../../organizations/infrastructure/decorators/current-terminal.decorator.js";
import {
  CurrentOrgUser,
  type AuthenticatedOrgUser,
} from "../../../organizations/infrastructure/decorators/current-org-user.decorator.js";
import { ConnectBlingUseCase } from "../../application/use-cases/connect-bling.use-case.js";
import { HandleBlingCallbackUseCase } from "../../application/use-cases/handle-bling-callback.use-case.js";
import { GetBlingConnectionStatusUseCase } from "../../application/use-cases/get-bling-connection-status.use-case.js";
import { ListBlingProductsUseCase } from "../../application/use-cases/list-bling-products.use-case.js";

/**
 * Achados C2/M1 da auditoria de segurança (2026-09-14) corrigidos: `connect`
 * e `status` passaram a exigir `OrgJwtAuthGuard` — só um admin autenticado
 * da própria organização inicia a conexão Bling dela ou consulta o status
 * dela (organizationId vem do token, nunca de query param solto). `callback`
 * continua público de propósito — é o redirect_uri do Bling, o próprio
 * Bling chama essa rota, sem sessão de admin nenhuma — mas agora só aceita
 * um `state` válido emitido por `connect` (ver BlingOAuthStateStore).
 * `GET /products` continua com TerminalApiKeyGuard (chamado pelo terminal,
 * não uma tela de admin — mesma fronteira de /fiscal e /sync).
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
  @UseGuards(OrgJwtAuthGuard)
  connect(@CurrentOrgUser() orgUser: AuthenticatedOrgUser, @Res() res: Response) {
    const url = this.connectBlingUseCase.execute(orgUser.organizationId);
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
  @UseGuards(OrgJwtAuthGuard)
  status(@CurrentOrgUser() orgUser: AuthenticatedOrgUser) {
    return this.getBlingConnectionStatusUseCase.execute(orgUser.organizationId);
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
