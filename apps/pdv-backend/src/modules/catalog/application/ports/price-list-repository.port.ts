import type { PriceListItem } from "../../domain/entities/price-list-item.entity.js";

export interface PriceListRecord {
  id: string;
  name: string;
  active: boolean;
}

export interface UpsertPriceListItemData {
  priceListId: string;
  productId: string;
  price: number;
  promotionalPrice: number | null;
}

export interface PriceListRepositoryPort {
  findActive(): Promise<PriceListRecord | null>;
  findById(id: string): Promise<PriceListRecord | null>;
  create(name: string): Promise<PriceListRecord>;
  upsertItem(data: UpsertPriceListItemData): Promise<PriceListItem>;
  findItem(priceListId: string, productId: string): Promise<PriceListItem | null>;
}

export const PRICE_LIST_REPOSITORY = Symbol("PRICE_LIST_REPOSITORY");
