import { Body, Controller, Param, Post, UseGuards, UsePipes } from "@nestjs/common";
import {
  createPriceListSchema,
  upsertPriceListItemSchema,
  type CreatePriceListInput,
  type UpsertPriceListItemInput,
} from "@easypdv/shared-validation";
import { ZodValidationPipe } from "../../../../common/pipes/zod-validation.pipe.js";
import { JwtAuthGuard } from "../../../identity/infrastructure/guards/jwt-auth.guard.js";
import { RolesGuard } from "../../../identity/infrastructure/guards/roles.guard.js";
import { Roles } from "../../../identity/infrastructure/decorators/roles.decorator.js";
import { CreatePriceListUseCase } from "../../application/use-cases/create-price-list.use-case.js";
import { UpsertPriceListItemUseCase } from "../../application/use-cases/upsert-price-list-item.use-case.js";

@Controller("price-lists")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("administrador", "gerente")
export class PriceListsController {
  constructor(
    private readonly createPriceListUseCase: CreatePriceListUseCase,
    private readonly upsertPriceListItemUseCase: UpsertPriceListItemUseCase,
  ) {}

  @Post()
  @UsePipes(new ZodValidationPipe(createPriceListSchema))
  create(@Body() body: CreatePriceListInput) {
    return this.createPriceListUseCase.execute(body.name);
  }

  @Post(":id/items")
  @UsePipes(new ZodValidationPipe(upsertPriceListItemSchema))
  upsertItem(@Param("id") id: string, @Body() body: UpsertPriceListItemInput) {
    return this.upsertPriceListItemUseCase.execute(id, body);
  }
}
