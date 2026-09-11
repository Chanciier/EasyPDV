import { Module } from "@nestjs/common";
import { OrganizationsModule } from "../organizations/organizations.module.js";
import { TerminalApiKeyGuard } from "../organizations/infrastructure/guards/terminal-api-key.guard.js";
import { CustomersController } from "./infrastructure/controllers/customers.controller.js";
import { PrismaCustomerRepository } from "./infrastructure/repositories/prisma-customer.repository.js";
import { CUSTOMER_REPOSITORY } from "./application/ports/customer-repository.port.js";
import { GetCustomerUseCase } from "./application/use-cases/get-customer.use-case.js";
import { FindCustomerByDocumentUseCase } from "./application/use-cases/find-customer-by-document.use-case.js";
import { SearchCustomersUseCase } from "./application/use-cases/search-customers.use-case.js";
import { CreateCustomerUseCase } from "./application/use-cases/create-customer.use-case.js";
import { UpdateCustomerUseCase } from "./application/use-cases/update-customer.use-case.js";
import { DeleteCustomerUseCase } from "./application/use-cases/delete-customer.use-case.js";

@Module({
  imports: [OrganizationsModule],
  controllers: [CustomersController],
  providers: [
    // Registrado de novo aqui (mesmo motivo de ClubModule/StoreCreditModule):
    // @UseGuards(TerminalApiKeyGuard) no CustomersController resolve a
    // instância dentro DESTE módulo, não reaproveita o singleton de
    // OrganizationsModule. Ver docs/MODULES.md.
    TerminalApiKeyGuard,
    GetCustomerUseCase,
    FindCustomerByDocumentUseCase,
    SearchCustomersUseCase,
    CreateCustomerUseCase,
    UpdateCustomerUseCase,
    DeleteCustomerUseCase,
    { provide: CUSTOMER_REPOSITORY, useClass: PrismaCustomerRepository },
  ],
})
export class CustomersModule {}
