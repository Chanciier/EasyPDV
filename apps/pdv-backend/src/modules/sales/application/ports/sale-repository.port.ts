import type { Sale } from "../../domain/entities/sale.entity.js";

export interface StartSaleData {
  cashSessionId: string;
  operatorUserId: string;
  customerId: string | null;
}

export interface AddSaleItemData {
  saleId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface SaleRepositoryPort {
  findById(id: string): Promise<Sale | null>;
  start(data: StartSaleData): Promise<Sale>;
  addItem(data: AddSaleItemData): Promise<Sale>;
  removeItem(saleId: string, itemId: string): Promise<Sale>;
  cancel(id: string): Promise<Sale>;
}

export const SALE_REPOSITORY = Symbol("SALE_REPOSITORY");
