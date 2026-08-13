import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { createWarehouseSchema, type CreateWarehouseInput } from "@easypdv/shared-validation";
import { ZodValidationPipe } from "../../../../common/pipes/zod-validation.pipe.js";
import { JwtAuthGuard } from "../../../identity/infrastructure/guards/jwt-auth.guard.js";
import { RolesGuard } from "../../../identity/infrastructure/guards/roles.guard.js";
import { Roles } from "../../../identity/infrastructure/decorators/roles.decorator.js";
import { CreateWarehouseUseCase } from "../../application/use-cases/create-warehouse.use-case.js";
import { ListWarehousesUseCase } from "../../application/use-cases/list-warehouses.use-case.js";

@Controller("warehouses")
@UseGuards(JwtAuthGuard, RolesGuard)
export class WarehousesController {
  constructor(
    private readonly createWarehouseUseCase: CreateWarehouseUseCase,
    private readonly listWarehousesUseCase: ListWarehousesUseCase,
  ) {}

  @Get()
  list() {
    return this.listWarehousesUseCase.execute();
  }

  @Post()
  @Roles("administrador", "gerente")
  create(@Body(new ZodValidationPipe(createWarehouseSchema)) body: CreateWarehouseInput) {
    return this.createWarehouseUseCase.execute(body.name);
  }
}
