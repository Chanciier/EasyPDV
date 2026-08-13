import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
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
import { StartSaleUseCase } from "../../application/use-cases/start-sale.use-case.js";
import { AddSaleItemUseCase } from "../../application/use-cases/add-sale-item.use-case.js";
import { RemoveSaleItemUseCase } from "../../application/use-cases/remove-sale-item.use-case.js";
import { CancelSaleUseCase } from "../../application/use-cases/cancel-sale.use-case.js";
import { GetSaleUseCase } from "../../application/use-cases/get-sale.use-case.js";
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
    private readonly registerPaymentUseCase: RegisterPaymentUseCase,
    private readonly confirmSaleUseCase: ConfirmSaleUseCase,
  ) {}

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
  confirm(@Param("id") id: string) {
    return this.confirmSaleUseCase.execute(id);
  }

  @Post(":id/cancel")
  cancel(@Param("id") id: string) {
    return this.cancelSaleUseCase.execute(id);
  }
}
