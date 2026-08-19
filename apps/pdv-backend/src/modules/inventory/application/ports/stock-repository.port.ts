import type { StockMovementType } from "@easypdv/shared-types";
import type { StockItem } from "../../domain/entities/stock-item.entity.js";
import type { StockMovement } from "../../domain/entities/stock-movement.entity.js";

export interface RegisterMovementData {
  warehouseId: string;
  productId: string;
  type: StockMovementType;
  quantity: number;
  referenceType?: string | null;
  referenceId?: string | null;
  createdByUserId?: string | null;
}

export interface ListMovementsFilter {
  warehouseId?: string;
  productId?: string;
}

/**
 * `registerMovement` grava o StockMovement (ledger) e atualiza o StockItem
 * (projeção) na mesma transação — nunca os dois separadamente. Ver docs/DATABASE.md.
 */
export interface StockRepositoryPort {
  getStockItem(warehouseId: string, productId: string): Promise<StockItem | null>;
  registerMovement(data: RegisterMovementData): Promise<StockMovement>;
  listMovements(filter: ListMovementsFilter): Promise<StockMovement[]>;
  /** Só linhas com StockItem já materializado — produto nunca movimentado não aparece (equivalente a 0, ver GetStockUseCase). */
  listByWarehouse(warehouseId: string): Promise<StockItem[]>;
}

export const STOCK_REPOSITORY = Symbol("STOCK_REPOSITORY");
