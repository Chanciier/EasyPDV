import type { Product } from "@easypdv/shared-types";
import type { Product as ProductEntity } from "../../domain/entities/product.entity.js";

export function toProductResponseDto(product: ProductEntity): Product {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    categoryId: product.categoryId,
    unit: product.unit,
    active: product.active,
  };
}
