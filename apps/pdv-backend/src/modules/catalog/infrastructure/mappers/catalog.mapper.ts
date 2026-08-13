import type { Category as PrismaCategory, PriceListItem as PrismaPriceListItem, Product as PrismaProduct } from "@prisma/client";
import { Category } from "../../domain/entities/category.entity.js";
import { PriceListItem } from "../../domain/entities/price-list-item.entity.js";
import { Product } from "../../domain/entities/product.entity.js";

export function toDomainProduct(record: PrismaProduct): Product {
  return new Product({
    id: record.id,
    sku: record.sku,
    name: record.name,
    categoryId: record.categoryId,
    unit: record.unit,
    active: record.active,
  });
}

export function toDomainCategory(record: PrismaCategory): Category {
  return new Category({
    id: record.id,
    name: record.name,
    parentCategoryId: record.parentCategoryId,
  });
}

export function toDomainPriceListItem(record: PrismaPriceListItem): PriceListItem {
  return new PriceListItem({
    id: record.id,
    priceListId: record.priceListId,
    productId: record.productId,
    price: record.price,
    promotionalPrice: record.promotionalPrice,
  });
}
