import { Module } from "@nestjs/common";
import { CustomersController } from "./infrastructure/controllers/customers.controller.js";
import { PrismaCustomerRepository } from "./infrastructure/repositories/prisma-customer.repository.js";
import { CUSTOMER_REPOSITORY } from "./application/ports/customer-repository.port.js";
import { CreateCustomerUseCase } from "./application/use-cases/create-customer.use-case.js";
import { UpdateCustomerUseCase } from "./application/use-cases/update-customer.use-case.js";
import { DeleteCustomerUseCase } from "./application/use-cases/delete-customer.use-case.js";
import { GetCustomerUseCase } from "./application/use-cases/get-customer.use-case.js";
import { SearchCustomersUseCase } from "./application/use-cases/search-customers.use-case.js";

@Module({
  controllers: [CustomersController],
  providers: [
    CreateCustomerUseCase,
    UpdateCustomerUseCase,
    DeleteCustomerUseCase,
    GetCustomerUseCase,
    SearchCustomersUseCase,
    { provide: CUSTOMER_REPOSITORY, useClass: PrismaCustomerRepository },
  ],
})
export class CustomersModule {}
