import { Module } from "@nestjs/common";
import { PrismaStoreIdentityRepository } from "../provisioning/infrastructure/repositories/prisma-store-identity.repository.js";
import { STORE_IDENTITY_REPOSITORY } from "../provisioning/application/ports/store-identity-repository.port.js";
import { CustomersController } from "./infrastructure/controllers/customers.controller.js";
import { HttpCustomerRepository } from "./infrastructure/repositories/http-customer.repository.js";
import { CUSTOMER_REPOSITORY } from "./application/ports/customer-repository.port.js";
import { CreateCustomerUseCase } from "./application/use-cases/create-customer.use-case.js";
import { UpdateCustomerUseCase } from "./application/use-cases/update-customer.use-case.js";
import { DeleteCustomerUseCase } from "./application/use-cases/delete-customer.use-case.js";
import { GetCustomerUseCase } from "./application/use-cases/get-customer.use-case.js";
import { SearchCustomersUseCase } from "./application/use-cases/search-customers.use-case.js";

/**
 * Cliente centralizado (2026-09-11) — CUSTOMER_REPOSITORY passou de
 * PrismaCustomerRepository (SQLite local, por terminal) pra
 * HttpCustomerRepository (Intermediador, compartilhado pela organização
 * inteira). Nenhum dos 6 use-cases de outros módulos que consomem este
 * port mudou (attach-customer-to-sale, apply-club-discount, confirm-sale,
 * register-payment, grant-store-credit, find-store-credit-customer) — só a
 * implementação por trás do token.
 *
 * NÃO importa ProvisioningModule — mesmo motivo documentado em
 * ClubModule/StoreCreditModule (ciclo Sales→Customers→Provisioning→Sales).
 * Registra o próprio STORE_IDENTITY_REPOSITORY aqui, mesma classe
 * PrismaStoreIdentityRepository, instância própria deste módulo.
 */
@Module({
  controllers: [CustomersController],
  providers: [
    CreateCustomerUseCase,
    UpdateCustomerUseCase,
    DeleteCustomerUseCase,
    GetCustomerUseCase,
    SearchCustomersUseCase,
    { provide: STORE_IDENTITY_REPOSITORY, useClass: PrismaStoreIdentityRepository },
    { provide: CUSTOMER_REPOSITORY, useClass: HttpCustomerRepository },
  ],
  // Consumido por AttachCustomerToSaleUseCase (Sales) pro fluxo "CPF na
  // nota" — busca-ou-cria por documento é acesso a dado simples, não
  // justifica um use-case novo só pra existir cross-módulo.
  exports: [CUSTOMER_REPOSITORY],
})
export class CustomersModule {}
