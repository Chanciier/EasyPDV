import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import type { SaleStatus } from "@easypdv/shared-types";
import {
  addSaleItemSchema,
  registerPaymentSchema,
  startSaleSchema,
  type AddSaleItemInput,
  type RegisterPaymentInput,
  type StartSaleInput,
} from "@easypdv/shared-validation";
import { ZodValidationPipe } from "../../../../common/pipes/zod-validation.pipe.js";
import { CurrentUser, type AuthenticatedUser } from "../../../identity/infrastructure/decorators/current-user.decorator.js";
import { JwtAuthGuard } from "../../../identity/infrastructure/guards/jwt-auth.guard.js";
import { RealtimeGateway } from "../../../realtime/realtime.gateway.js";
import { StartSaleUseCase } from "../../application/use-cases/start-sale.use-case.js";
import { AddSaleItemUseCase } from "../../application/use-cases/add-sale-item.use-case.js";
import { RemoveSaleItemUseCase } from "../../application/use-cases/remove-sale-item.use-case.js";
import { CancelSaleUseCase } from "../../application/use-cases/cancel-sale.use-case.js";
import { GetSaleUseCase } from "../../application/use-cases/get-sale.use-case.js";
import { ListSalesUseCase } from "../../application/use-cases/list-sales.use-case.js";
import { RegisterPaymentUseCase } from "../../application/use-cases/register-payment.use-case.js";
import { ConfirmSaleUseCase } from "../../application/use-cases/confirm-sale.use-case.js";

@Controller("sales")
@UseGuards(JwtAuthGuard)
export class SalesController {
  constructor(
    private readonly startSaleUseCase: StartSaleUseCase,
    private readonly addSaleItemUseCase: AddSaleItemUseCase,
    private readonly removeSaleItemUseCase: RemoveSaleItemUseCase,
    private readonly cancelSaleUseCase: CancelSaleUseCase,
    private readonly getSaleUseCase: GetSaleUseCase,
    private readonly listSalesUseCase: ListSalesUseCase,
    private readonly registerPaymentUseCase: RegisterPaymentUseCase,
    private readonly confirmSaleUseCase: ConfirmSaleUseCase,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  @Get()
  list(@Query("status") status?: SaleStatus, @Query("cashSessionId") cashSessionId?: string) {
    return this.listSalesUseCase.execute({ status, cashSessionId });
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.getSaleUseCase.execute(id);
  }

  @Post()
  start(@Body(new ZodValidationPipe(startSaleSchema)) body: StartSaleInput, @CurrentUser() user: AuthenticatedUser) {
    return this.startSaleUseCase.execute(body, user.userId);
  }

  @Post(":id/items")
  addItem(@Param("id") id: string, @Body(new ZodValidationPipe(addSaleItemSchema)) body: AddSaleItemInput) {
    return this.addSaleItemUseCase.execute(id, body);
  }

  @Delete(":id/items/:itemId")
  removeItem(@Param("id") id: string, @Param("itemId") itemId: string) {
    return this.removeSaleItemUseCase.execute(id, itemId);
  }

  @Post(":id/payments")
  registerPayment(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(registerPaymentSchema)) body: RegisterPaymentInput,
  ) {
    return this.registerPaymentUseCase.execute(id, body);
  }

  @Post(":id/confirm")
  async confirm(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    const sale = await this.confirmSaleUseCase.execute(id, user.userId);
    this.realtimeGateway.emitSaleConfirmed({
      saleId: sale.id,
      totalAmount: sale.totalAmount,
      confirmedAt: sale.confirmedAt!.toISOString(),
    });
    return sale;
  }

  @Post(":id/cancel")
  cancel(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.cancelSaleUseCase.execute(id, user.userId);
  }
}
