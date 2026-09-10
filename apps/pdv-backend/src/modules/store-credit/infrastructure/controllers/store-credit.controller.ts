import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { createStoreCreditGrantSchema, type CreateStoreCreditGrantInput } from "@easypdv/shared-validation";
import { ZodValidationPipe } from "../../../../common/pipes/zod-validation.pipe.js";
import { JwtAuthGuard } from "../../../identity/infrastructure/guards/jwt-auth.guard.js";
import { CurrentUser, type AuthenticatedUser } from "../../../identity/infrastructure/decorators/current-user.decorator.js";
import { FindStoreCreditCustomerUseCase } from "../../application/use-cases/find-store-credit-customer.use-case.js";
import { GrantStoreCreditUseCase } from "../../application/use-cases/grant-store-credit.use-case.js";
import { GetStoreCreditBalanceUseCase } from "../../application/use-cases/get-store-credit-balance.use-case.js";

/** Sem RolesGuard de propósito — visível/usável por todo operador de caixa, mesmo padrão de "Clientes" e "Clube". */
@Controller("store-credit")
@UseGuards(JwtAuthGuard)
export class StoreCreditController {
  constructor(
    private readonly findStoreCreditCustomerUseCase: FindStoreCreditCustomerUseCase,
    private readonly grantStoreCreditUseCase: GrantStoreCreditUseCase,
    private readonly getStoreCreditBalanceUseCase: GetStoreCreditBalanceUseCase,
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
}
