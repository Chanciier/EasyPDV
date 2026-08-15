import { Inject, Injectable } from "@nestjs/common";
import type { RegisterStockMovementInput } from "@easypdv/shared-validation";
import { WarehouseNotFoundError } from "../../domain/errors.js";
import type { StockMovement } from "../../domain/entities/stock-movement.entity.js";
import { WAREHOUSE_REPOSITORY, type WarehouseRepositoryPort } from "../ports/warehouse-repository.port.js";
import { STOCK_REPOSITORY, type StockRepositoryPort } from "../ports/stock-repository.port.js";
import {
  AUDIT_LOG_REPOSITORY,
  type AuditLogRepositoryPort,
} from "../../../audit/application/ports/audit-log-repository.port.js";

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
    @Inject(AUDIT_LOG_REPOSITORY) private readonly auditLogRepository: AuditLogRepositoryPort,
  ) {}

  async execute(input: RegisterStockMovementInput, createdByUserId: string | null): Promise<StockMovement> {
    const warehouse = await this.warehouseRepository.findById(input.warehouseId);
    if (!warehouse) {
      throw new WarehouseNotFoundError(input.warehouseId);
    }
    const movement = await this.stockRepository.registerMovement({
      warehouseId: input.warehouseId,
      productId: input.productId,
      type: input.type,
      quantity: input.quantity,
      createdByUserId,
    });
    await this.auditLogRepository.record({
      userId: createdByUserId,
      action: "stock_movement.registered",
      entityType: "product",
      entityId: input.productId,
      metadata: { warehouseId: input.warehouseId, type: input.type, quantity: input.quantity },
    });
    return movement;
  }
}
