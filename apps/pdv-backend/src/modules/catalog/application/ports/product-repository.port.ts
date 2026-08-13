import type { Product } from "../../domain/entities/product.entity.js";

export interface CreateProductData {
  sku: string;
  name: string;
  categoryId: string | null;
  unit: string;
}

export interface UpdateProductData {
  name?: string;
  categoryId?: string | null;
  unit?: string;
  active?: boolean;
}

export interface ProductRepositoryPort {
  findById(id: string): Promise<Product | null>;
  findBySku(sku: string): Promise<Product | null>;
  findByBarcode(code: string): Promise<Product | null>;
  search(query: string): Promise<Product[]>;
  create(data: CreateProductData): Promise<Product>;
  update(id: string, data: UpdateProductData): Promise<Product>;
  addBarcode(productId: string, code: string, type: string): Promise<void>;
  findBarcodeByCode(code: string): Promise<{ productId: string } | null>;
}

export const PRODUCT_REPOSITORY = Symbol("PRODUCT_REPOSITORY");
