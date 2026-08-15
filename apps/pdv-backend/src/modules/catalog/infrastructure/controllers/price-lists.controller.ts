import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import {
  createPriceListSchema,
  upsertPriceListItemSchema,
  type CreatePriceListInput,
  type UpsertPriceListItemInput,
} from "@easypdv/shared-validation";
import { ZodValidationPipe } from "../../../../common/pipes/zod-validation.pipe.js";
import { CurrentUser, type AuthenticatedUser } from "../../../identity/infrastructure/decorators/current-user.decorator.js";
import { JwtAuthGuard } from "../../../identity/infrastructure/guards/jwt-auth.guard.js";
import { RolesGuard } from "../../../identity/infrastructure/guards/roles.guard.js";
import { Roles } from "../../../identity/infrastructure/decorators/roles.decorator.js";
import { CreatePriceListUseCase } from "../../application/use-cases/create-price-list.use-case.js";
import { UpsertPriceListItemUseCase } from "../../application/use-cases/upsert-price-list-item.use-case.js";
import { GetActivePriceListUseCase } from "../../application/use-cases/get-active-price-list.use-case.js";

@Controller("price-lists")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("administrador", "gerente")
export class PriceListsController {
  constructor(
    private readonly createPriceListUseCase: CreatePriceListUseCase,
    private readonly upsertPriceListItemUseCase: UpsertPriceListItemUseCase,
    private readonly getActivePriceListUseCase: GetActivePriceListUseCase,
  ) {}

  @Get("active")
  getActive() {
    return this.getActivePriceListUseCase.execute();
  }

  @Post()
  create(@Body(new ZodValidationPipe(createPriceListSchema)) body: CreatePriceListInput) {
    return this.createPriceListUseCase.execute(body.name);
  }

  @Post(":id/items")
  upsertItem(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(upsertPriceListItemSchema)) body: UpsertPriceListItemInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.upsertPriceListItemUseCase.execute(id, body, user.userId);
  }
}
