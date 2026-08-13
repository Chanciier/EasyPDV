import { Body, Controller, Get, Post, UseGuards, UsePipes } from "@nestjs/common";
import { createCategorySchema, type CreateCategoryInput } from "@easypdv/shared-validation";
import { ZodValidationPipe } from "../../../../common/pipes/zod-validation.pipe.js";
import { JwtAuthGuard } from "../../../identity/infrastructure/guards/jwt-auth.guard.js";
import { RolesGuard } from "../../../identity/infrastructure/guards/roles.guard.js";
import { Roles } from "../../../identity/infrastructure/decorators/roles.decorator.js";
import { CreateCategoryUseCase } from "../../application/use-cases/create-category.use-case.js";
import { ListCategoriesUseCase } from "../../application/use-cases/list-categories.use-case.js";

@Controller("categories")
@UseGuards(JwtAuthGuard, RolesGuard)
export class CategoriesController {
  constructor(
    private readonly createCategoryUseCase: CreateCategoryUseCase,
    private readonly listCategoriesUseCase: ListCategoriesUseCase,
  ) {}

  @Get()
  list() {
    return this.listCategoriesUseCase.execute();
  }

  @Post()
  @Roles("administrador", "gerente")
  @UsePipes(new ZodValidationPipe(createCategorySchema))
  create(@Body() body: CreateCategoryInput) {
    return this.createCategoryUseCase.execute(body);
  }
}
