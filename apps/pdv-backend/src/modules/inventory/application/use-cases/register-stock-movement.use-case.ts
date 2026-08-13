import { Inject, Injectable } from "@nestjs/common";
import type { RegisterStockMovementInput } from "@easypdv/shared-validation";
import { WarehouseNotFoundError } from "../../domain/errors.js";
import type { StockMovement } from "../../domain/entities/stock-movement.entity.js";
import { WAREHOUSE_REPOSITORY, type WarehouseRepositoryPort } from "../ports/warehouse-repository.port.js";
import { STOCK_REPOSITORY, type StockRepositoryPort } from "../ports/stock-repository.port.js";

/**
 * Estoque negativo é permitido de propósito (avisa mas não bloqueia) — não é
 * papel deste use case decidir se uma venda pode prosseguir sem saldo
 * suficiente, isso é responsabilidade do módulo Sales. Ver docs/ERROR-HANDLING.md.
 */
@Injectable()
export class RegisterStockMovementUseCase {
  constructor(
    @Inject(WAREHOUSE_REPOSITORY) private readonly warehouseRepository: WarehouseRepositoryPort,
    @Inject(STOCK_REPOSITORY) private readonly stockRepository: StockRepositoryPort,
  ) {}

  async execute(input: RegisterStockMovementInput, createdByUserId: string | null): Promise<StockMovement> {
    const warehouse = await this.warehouseRepository.findById(input.warehouseId);
    if (!warehouse) {
      throw new WarehouseNotFoundError(input.warehouseId);
    }
    return this.stockRepository.registerMovement({
      warehouseId: input.warehouseId,
      productId: input.productId,
      type: input.type,
      quantity: input.quantity,
      createdByUserId,
    });
  }
}
