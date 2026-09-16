import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import {
  adjustStoreCreditSchema,
  createStoreCreditGrantSchema,
  type AdjustStoreCreditInput,
  type CreateStoreCreditGrantInput,
} from "@easypdv/shared-validation";
import { ZodValidationPipe } from "../../../../common/pipes/zod-validation.pipe.js";
import { JwtAuthGuard } from "../../../identity/infrastructure/guards/jwt-auth.guard.js";
import { RolesGuard } from "../../../identity/infrastructure/guards/roles.guard.js";
import { Roles } from "../../../identity/infrastructure/decorators/roles.decorator.js";
import { CurrentUser, type AuthenticatedUser } from "../../../identity/infrastructure/decorators/current-user.decorator.js";
import { FindStoreCreditCustomerUseCase } from "../../application/use-cases/find-store-credit-customer.use-case.js";
import { GrantStoreCreditUseCase } from "../../application/use-cases/grant-store-credit.use-case.js";
import { GetStoreCreditBalanceUseCase } from "../../application/use-cases/get-store-credit-balance.use-case.js";
import { AdjustStoreCreditUseCase } from "../../application/use-cases/adjust-store-credit.use-case.js";

/**
 * `RolesGuard` adicionado (2026-09-16) só por causa de `adjustments` —
 * as rotas de sempre (customer/balance/grants) continuam sem `@Roles`,
 * visíveis/usáveis por todo operador de caixa, mesmo padrão de "Clientes" e
 * "Clube". Ajuste manual de saldo é a exceção: pedido explícito do usuário
 * pra restringir a administrador/gerente, mesmo padrão já usado em
 * "Cancelar venda" (SalesController.voidSale).
 */
@Controller("store-credit")
@UseGuards(JwtAuthGuard, RolesGuard)
export class StoreCreditController {
  constructor(
    private readonly findStoreCreditCustomerUseCase: FindStoreCreditCustomerUseCase,
    private readonly grantStoreCreditUseCase: GrantStoreCreditUseCase,
    private readonly getStoreCreditBalanceUseCase: GetStoreCreditBalanceUseCase,
    private readonly adjustStoreCreditUseCase: AdjustStoreCreditUseCase,
  ) {}

  /** Consultado no portão de CPF da tela de Vale-Troca — decide se pede nome+telefone (CPF novo) ou segue direto. */
  @Get("customer/:document")
  async customer(@Param("document") document: string) {
    const customer = await this.findStoreCreditCustomerUseCase.execute(document);
    return { found: !!customer, customer };
  }

  /** Fase 3 (2026-09-10) — consultado no portão de CPF de uma venda normal e na tela de pagamento, pra mostrar/validar o saldo antes de escolher "Vale-Troca". `balance: null` = não deu pra saber (terminal não ativado ou rede indisponível) — o frontend trata como "sem saldo visível", nunca bloqueia a venda só por isso. */
  @Get("balance/:document")
  async balance(@Param("document") document: string) {
    const balance = await this.getStoreCreditBalanceUseCase.execute(document);
    return { balance };
  }

  @Post("grants")
  grant(
    @Body(new ZodValidationPipe(createStoreCreditGrantSchema)) body: CreateStoreCreditGrantInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.grantStoreCreditUseCase.execute(body, user.userId);
  }

  @Post("adjustments")
  @Roles("administrador", "gerente")
  adjust(
    @Body(new ZodValidationPipe(adjustStoreCreditSchema)) body: AdjustStoreCreditInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adjustStoreCreditUseCase.execute(body, user.userId);
  }
}
