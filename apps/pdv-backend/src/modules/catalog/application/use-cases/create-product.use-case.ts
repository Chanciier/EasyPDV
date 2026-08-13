import { Inject, Injectable } from "@nestjs/common";
import type { CreateProductInput } from "@easypdv/shared-validation";
import { SkuAlreadyInUseError } from "../../domain/errors.js";
import type { Product } from "../../domain/entities/product.entity.js";
import { PRODUCT_REPOSITORY, type ProductRepositoryPort } from "../ports/product-repository.port.js";

@Injectable()
export class CreateProductUseCase {
  constructor(@Inject(PRODUCT_REPOSITORY) private readonly productRepository: ProductRepositoryPort) {}

  async execute(input: CreateProductInput): Promise<Product> {
    const existing = await this.productRepository.findBySku(input.sku);
    if (existing) {
      throw new SkuAlreadyInUseError(input.sku);
    }
    return this.productRepository.create({
      sku: input.sku,
      name: input.name,
      categoryId: input.categoryId ?? null,
      unit: input.unit,
    });
  }
}
