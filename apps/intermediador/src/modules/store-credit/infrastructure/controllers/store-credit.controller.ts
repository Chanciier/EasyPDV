import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import {
  grantStoreCreditSchema,
  redeemStoreCreditSchema,
  type GrantStoreCreditInput,
  type RedeemStoreCreditInput,
} from "@easypdv/shared-validation";
import { ZodValidationPipe } from "../../../../common/pipes/zod-validation.pipe.js";
import { TerminalApiKeyGuard } from "../../../organizations/infrastructure/guards/terminal-api-key.guard.js";
import {
  CurrentTerminal,
  type AuthenticatedTerminal,
} from "../../../organizations/infrastructure/decorators/current-terminal.decorator.js";
import { GetStoreCreditBalanceUseCase } from "../../application/use-cases/get-store-credit-balance.use-case.js";
import { GrantStoreCreditUseCase } from "../../application/use-cases/grant-store-credit.use-case.js";
import { RedeemStoreCreditUseCase } from "../../application/use-cases/redeem-store-credit.use-case.js";

/**
 * Vale-Troca (2026-09-10) — chamado pelo PDV local, mesma fronteira de
 * confiança de /club e /fiscal (ver docblocks lá). Escopado sempre pela
 * organização do terminal autenticado, nunca aceita organizationId no
 * corpo. Saldo GERAL por organização (não por loja) — pedido explícito do
 * usuário, ver Planejamento - Vale-Troca (Crédito por CPF).md no cofre
 * Obsidian.
 */
@Controller("store-credit")
@UseGuards(TerminalApiKeyGuard)
export class StoreCreditController {
  constructor(
    private readonly getStoreCreditBalanceUseCase: GetStoreCreditBalanceUseCase,
    private readonly grantStoreCreditUseCase: GrantStoreCreditUseCase,
    private readonly redeemStoreCreditUseCase: RedeemStoreCreditUseCase,
  ) {}

  @Get("balance/:document")
  async balance(@Param("document") document: string, @CurrentTerminal() terminal: AuthenticatedTerminal) {
    const balance = await this.getStoreCreditBalanceUseCase.execute(terminal.organizationId, document);
    return { balance };
  }

  @Post("grants")
  grant(
    @Body(new ZodValidationPipe(grantStoreCreditSchema)) body: GrantStoreCreditInput,
    @CurrentTerminal() terminal: AuthenticatedTerminal,
  ) {
    return this.grantStoreCreditUseCase.execute(
      { organizationId: terminal.organizationId, storeId: terminal.storeId, terminalId: terminal.terminalId },
      body,
    );
  }

  @Post("redemptions")
  redeem(
    @Body(new ZodValidationPipe(redeemStoreCreditSchema)) body: RedeemStoreCreditInput,
    @CurrentTerminal() terminal: AuthenticatedTerminal,
  ) {
    return this.redeemStoreCreditUseCase.execute(
      { organizationId: terminal.organizationId, storeId: terminal.storeId, terminalId: terminal.terminalId },
      body,
    );
  }
}
