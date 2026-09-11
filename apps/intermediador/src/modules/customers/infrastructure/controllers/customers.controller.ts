import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import {
  createCustomerSchema,
  updateCustomerSchema,
  type CreateCustomerInput,
  type UpdateCustomerInput,
} from "@easypdv/shared-validation";
import { ZodValidationPipe } from "../../../../common/pipes/zod-validation.pipe.js";
import { TerminalApiKeyGuard } from "../../../organizations/infrastructure/guards/terminal-api-key.guard.js";
import {
  CurrentTerminal,
  type AuthenticatedTerminal,
} from "../../../organizations/infrastructure/decorators/current-terminal.decorator.js";
import { GetCustomerUseCase } from "../../application/use-cases/get-customer.use-case.js";
import { FindCustomerByDocumentUseCase } from "../../application/use-cases/find-customer-by-document.use-case.js";
import { SearchCustomersUseCase } from "../../application/use-cases/search-customers.use-case.js";
import { CreateCustomerUseCase } from "../../application/use-cases/create-customer.use-case.js";
import { UpdateCustomerUseCase } from "../../application/use-cases/update-customer.use-case.js";
import { DeleteCustomerUseCase } from "../../application/use-cases/delete-customer.use-case.js";

/**
 * Cliente centralizado (2026-09-11) — chamado pelo PDV local, mesma
 * fronteira de confiança de /club e /store-credit (ver docblocks lá).
 * Escopado sempre pela organização do terminal autenticado, nunca aceita
 * organizationId no corpo. Ver Planejamento em cofre Obsidian (nota desta
 * mudança) e docs/CHANGELOG.md.
 */
@Controller("customers")
@UseGuards(TerminalApiKeyGuard)
export class CustomersController {
  constructor(
    private readonly getCustomerUseCase: GetCustomerUseCase,
    private readonly findCustomerByDocumentUseCase: FindCustomerByDocumentUseCase,
    private readonly searchCustomersUseCase: SearchCustomersUseCase,
    private readonly createCustomerUseCase: CreateCustomerUseCase,
    private readonly updateCustomerUseCase: UpdateCustomerUseCase,
    private readonly deleteCustomerUseCase: DeleteCustomerUseCase,
  ) {}

  @Get()
  search(@Query("query") query: string | undefined, @CurrentTerminal() terminal: AuthenticatedTerminal) {
    return this.searchCustomersUseCase.execute(terminal.organizationId, query);
  }

  @Get("by-document/:document")
  byDocument(@Param("document") document: string, @CurrentTerminal() terminal: AuthenticatedTerminal) {
    return this.findCustomerByDocumentUseCase.execute(terminal.organizationId, document);
  }

  @Get(":id")
  get(@Param("id") id: string, @CurrentTerminal() terminal: AuthenticatedTerminal) {
    return this.getCustomerUseCase.execute(terminal.organizationId, id);
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(createCustomerSchema)) body: CreateCustomerInput,
    @CurrentTerminal() terminal: AuthenticatedTerminal,
  ) {
    return this.createCustomerUseCase.execute(terminal.organizationId, body);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateCustomerSchema)) body: UpdateCustomerInput,
    @CurrentTerminal() terminal: AuthenticatedTerminal,
  ) {
    return this.updateCustomerUseCase.execute(terminal.organizationId, id, body);
  }

  @Delete(":id")
  async delete(@Param("id") id: string, @CurrentTerminal() terminal: AuthenticatedTerminal) {
    await this.deleteCustomerUseCase.execute(terminal.organizationId, id);
    return { success: true };
  }
}
