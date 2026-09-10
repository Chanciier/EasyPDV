import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { CatalogModule } from "../catalog/catalog.module.js";
import { InventoryModule } from "../inventory/inventory.module.js";
import { CustomersModule } from "../customers/customers.module.js";
import { PrismaStoreIdentityRepository } from "../provisioning/infrastructure/repositories/prisma-store-identity.repository.js";
import { STORE_IDENTITY_REPOSITORY } from "../provisioning/application/ports/store-identity-repository.port.js";
import { StoreCreditController } from "./infrastructure/controllers/store-credit.controller.js";
import { HttpStoreCreditGateway } from "./infrastructure/gateways/http-store-credit.gateway.js";
import { STORE_CREDIT_GATEWAY } from "./application/ports/store-credit-gateway.port.js";
import { FindStoreCreditCustomerUseCase } from "./application/use-cases/find-store-credit-customer.use-case.js";
import { GrantStoreCreditUseCase } from "./application/use-cases/grant-store-credit.use-case.js";
import { GetStoreCreditBalanceUseCase } from "./application/use-cases/get-store-credit-balance.use-case.js";

/**
 * NÃO importa ProvisioningModule — mesmo motivo documentado em ClubModule
 * (2026-08-25, bug real de boot: ProvisioningModule → SalesModule →
 * StoreCreditModule [Fase 3, resgate] → ProvisioningModule fecharia o
 * ciclo). Registra o próprio STORE_IDENTITY_REPOSITORY aqui, mesma classe
 * `PrismaStoreIdentityRepository` que ProvisioningModule usa, instância
 * própria deste módulo (inofensivo, wrapper sem estado sobre o
 * PrismaService, que já é @Global).
 *
 * CatalogModule/InventoryModule/CustomersModule/AuditModule são módulos
 * folha (nenhum deles depende de Sales/Provisioning/StoreCreditModule de
 * volta — conferido antes de importar) — sem risco de ciclo, mesmo padrão
 * de leitura síncrona entre módulos já documentado em docs/MODULES.md.
 *
 * Fase 2 (2026-09-10): geração de crédito (GrantStoreCreditUseCase) — acha/
 * cria Customer, resolve produto+preço no servidor, chama o Intermediador,
 * devolve ao estoque os itens `restock: true`.
 *
 * Fase 3 (2026-09-10): resgate na venda normal. SalesModule importa este
 * módulo (só pelo STORE_CREDIT_GATEWAY exportado, mesmo padrão de
 * ClubModule/CLUB_GATEWAY) — RegisterPaymentUseCase valida saldo de forma
 * consultiva a cada perna "vale_troca", ConfirmSaleUseCase debita de
 * verdade no mesmo instante em que debita o estoque. Sem risco de ciclo:
 * StoreCreditModule não importa SalesModule (nem nada que importe).
 * GetStoreCreditBalanceUseCase (local, distinto do use-case de mesmo nome
 * no Intermediador) expõe o saldo pro frontend mostrar no portão de CPF e
 * na tela de pagamento. Ver Planejamento - Vale-Troca (Crédito por CPF).md
 * no cofre Obsidian.
 */
@Module({
  imports: [AuditModule, CatalogModule, InventoryModule, CustomersModule],
  controllers: [StoreCreditController],
  providers: [
    { provide: STORE_IDENTITY_REPOSITORY, useClass: PrismaStoreIdentityRepository },
    { provide: STORE_CREDIT_GATEWAY, useClass: HttpStoreCreditGateway },
    FindStoreCreditCustomerUseCase,
    GrantStoreCreditUseCase,
    GetStoreCreditBalanceUseCase,
  ],
  exports: [STORE_CREDIT_GATEWAY],
})
export class StoreCreditModule {}
