import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { CatalogModule } from "../catalog/catalog.module.js";
import { CustomersModule } from "../customers/customers.module.js";
import { InventoryModule } from "../inventory/inventory.module.js";
import { RealtimeModule } from "../realtime/realtime.module.js";
import { CashController } from "./infrastructure/controllers/cash.controller.js";
import { SalesController } from "./infrastructure/controllers/sales.controller.js";
import { PrismaCashRepository } from "./infrastructure/repositories/prisma-cash.repository.js";
import { PrismaSaleRepository } from "./infrastructure/repositories/prisma-sale.repository.js";
import { PrismaFiscalStatusReader } from "./infrastructure/repositories/prisma-fiscal-status-reader.js";
import { CASH_REPOSITORY } from "./application/ports/cash-repository.port.js";
import { SALE_REPOSITORY } from "./application/ports/sale-repository.port.js";
import { FISCAL_STATUS_READER } from "./application/ports/fiscal-status-reader.port.js";
import { CreateCashRegisterUseCase } from "./application/use-cases/create-cash-register.use-case.js";
import { ListCashRegistersUseCase } from "./application/use-cases/list-cash-registers.use-case.js";
import { OpenCashSessionUseCase } from "./application/use-cases/open-cash-session.use-case.js";
import { CloseCashSessionUseCase } from "./application/use-cases/close-cash-session.use-case.js";
import { RegisterCashMovementUseCase } from "./application/use-cases/register-cash-movement.use-case.js";
import { GetCurrentCashSessionUseCase } from "./application/use-cases/get-current-cash-session.use-case.js";
import { GetCashSessionUseCase } from "./application/use-cases/get-cash-session.use-case.js";
import { ListCashMovementsUseCase } from "./application/use-cases/list-cash-movements.use-case.js";
import { GetTerminalBusyStatusUseCase } from "./application/use-cases/get-terminal-busy-status.use-case.js";
import { StartSaleUseCase } from "./application/use-cases/start-sale.use-case.js";
import { AddSaleItemUseCase } from "./application/use-cases/add-sale-item.use-case.js";
import { RemoveSaleItemUseCase } from "./application/use-cases/remove-sale-item.use-case.js";
import { CancelSaleUseCase } from "./application/use-cases/cancel-sale.use-case.js";
import { GetSaleUseCase } from "./application/use-cases/get-sale.use-case.js";
import { ListSalesUseCase } from "./application/use-cases/list-sales.use-case.js";
import { RegisterPaymentUseCase } from "./application/use-cases/register-payment.use-case.js";
import { ConfirmSaleUseCase } from "./application/use-cases/confirm-sale.use-case.js";
import { ApplySaleDiscountUseCase } from "./application/use-cases/apply-sale-discount.use-case.js";
import { VoidConfirmedSaleUseCase } from "./application/use-cases/void-confirmed-sale.use-case.js";
import { AttachCustomerToSaleUseCase } from "./application/use-cases/attach-customer-to-sale.use-case.js";

@Module({
  imports: [CatalogModule, InventoryModule, AuditModule, RealtimeModule, CustomersModule],
  controllers: [CashController, SalesController],
  providers: [
    CreateCashRegisterUseCase,
    ListCashRegistersUseCase,
    OpenCashSessionUseCase,
    CloseCashSessionUseCase,
    RegisterCashMovementUseCase,
    GetCurrentCashSessionUseCase,
    GetCashSessionUseCase,
    ListCashMovementsUseCase,
    GetTerminalBusyStatusUseCase,
    StartSaleUseCase,
    AddSaleItemUseCase,
    RemoveSaleItemUseCase,
    CancelSaleUseCase,
    GetSaleUseCase,
    ListSalesUseCase,
    RegisterPaymentUseCase,
    ConfirmSaleUseCase,
    ApplySaleDiscountUseCase,
    VoidConfirmedSaleUseCase,
    AttachCustomerToSaleUseCase,
    { provide: CASH_REPOSITORY, useClass: PrismaCashRepository },
    { provide: SALE_REPOSITORY, useClass: PrismaSaleRepository },
    { provide: FISCAL_STATUS_READER, useClass: PrismaFiscalStatusReader },
  ],
  // GetTerminalBusyStatusUseCase é consumido pelo ProvisioningController —
  // leitura entre módulos, mesmo padrão de ResolvePriceUseCase. Ver docs/MODULES.md.
  exports: [GetTerminalBusyStatusUseCase],
})
export class SalesModule {}
