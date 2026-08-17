import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import {
  createCustomerSchema,
  updateCustomerSchema,
  type CreateCustomerInput,
  type UpdateCustomerInput,
} from "@easypdv/shared-validation";
import { ZodValidationPipe } from "../../../../common/pipes/zod-validation.pipe.js";
import { JwtAuthGuard } from "../../../identity/infrastructure/guards/jwt-auth.guard.js";
import { RolesGuard } from "../../../identity/infrastructure/guards/roles.guard.js";
import { Roles } from "../../../identity/infrastructure/decorators/roles.decorator.js";
import { CreateCustomerUseCase } from "../../application/use-cases/create-customer.use-case.js";
import { UpdateCustomerUseCase } from "../../application/use-cases/update-customer.use-case.js";
import { DeleteCustomerUseCase } from "../../application/use-cases/delete-customer.use-case.js";
import { GetCustomerUseCase } from "../../application/use-cases/get-customer.use-case.js";
import { SearchCustomersUseCase } from "../../application/use-cases/search-customers.use-case.js";

/**
 * list/get/create/update sem @Roles — cadastrar/editar cliente é ação de
 * atendimento normal, mesmo padrão de sangria/desconto. delete restrito
 * (mais consequente, mesmo padrão de CashController.createRegister).
 */
@Controller("customers")
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomersController {
  constructor(
    private readonly createCustomerUseCase: CreateCustomerUseCase,
    private readonly updateCustomerUseCase: UpdateCustomerUseCase,
    private readonly deleteCustomerUseCase: DeleteCustomerUseCase,
    private readonly getCustomerUseCase: GetCustomerUseCase,
    private readonly searchCustomersUseCase: SearchCustomersUseCase,
  ) {}

  @Get()
  search(@Query("query") query?: string) {
    return this.searchCustomersUseCase.execute(query);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.getCustomerUseCase.execute(id);
  }

  @Post()
  create(@Body(new ZodValidationPipe(createCustomerSchema)) body: CreateCustomerInput) {
    return this.createCustomerUseCase.execute(body);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateCustomerSchema)) body: UpdateCustomerInput,
  ) {
    return this.updateCustomerUseCase.execute(id, body);
  }

  @Delete(":id")
  @Roles("administrador", "gerente")
  async delete(@Param("id") id: string) {
    await this.deleteCustomerUseCase.execute(id);
    return { success: true };
  }
}
