import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { WarehousesController } from "./infrastructure/controllers/warehouses.controller.js";
import { StockController } from "./infrastructure/controllers/stock.controller.js";
import { PrismaWarehouseRepository } from "./infrastructure/repositories/prisma-warehouse.repository.js";
import { PrismaStockRepository } from "./infrastructure/repositories/prisma-stock.repository.js";
import { WAREHOUSE_REPOSITORY } from "./application/ports/warehouse-repository.port.js";
import { STOCK_REPOSITORY } from "./application/ports/stock-repository.port.js";
import { CreateWarehouseUseCase } from "./application/use-cases/create-warehouse.use-case.js";
import { ListWarehousesUseCase } from "./application/use-cases/list-warehouses.use-case.js";
import { RegisterStockMovementUseCase } from "./application/use-cases/register-stock-movement.use-case.js";
import { GetStockUseCase } from "./application/use-cases/get-stock.use-case.js";
import { ListStockUseCase } from "./application/use-cases/list-stock.use-case.js";
import { ListStockMovementsUseCase } from "./application/use-cases/list-stock-movements.use-case.js";

@Module({
  imports: [AuditModule],
  controllers: [WarehousesController, StockController],
  providers: [
    CreateWarehouseUseCase,
    ListWarehousesUseCase,
    RegisterStockMovementUseCase,
    GetStockUseCase,
    ListStockUseCase,
    ListStockMovementsUseCase,
    { provide: WAREHOUSE_REPOSITORY, useClass: PrismaWarehouseRepository },
    { provide: STOCK_REPOSITORY, useClass: PrismaStockRepository },
  ],
  // ListWarehousesUseCase é consumido pelo módulo Sales (ConfirmSaleUseCase)
  // pra resolver o depósito padrão — leitura síncrona entre módulos, ver docs/MODULES.md.
  // GetStockUseCase: mesmo padrão, consumido por AddSaleItemUseCase pra checar
  // estoque disponível antes de deixar adicionar um item à venda (2026-08-19).
  exports: [ListWarehousesUseCase, GetStockUseCase],
})
export class InventoryModule {}
