import type { StockItem as PrismaStockItem, StockMovement as PrismaStockMovement } from "@prisma/client";
import { StockItem } from "../../domain/entities/stock-item.entity.js";
import { StockMovement } from "../../domain/entities/stock-movement.entity.js";

export function toDomainStockItem(record: PrismaStockItem): StockItem {
  return new StockItem({
    warehouseId: record.warehouseId,
    productId: record.productId,
    quantity: record.quantity,
    reservedQuantity: record.reservedQuantity,
  });
}

export function toDomainStockMovement(record: PrismaStockMovement): StockMovement {
  return new StockMovement({
    id: record.id,
    warehouseId: record.warehouseId,
    productId: record.productId,
    type: record.type,
    quantity: record.quantity,
    referenceType: record.referenceType,
    referenceId: record.referenceId,
    createdAt: record.createdAt,
  });
}
