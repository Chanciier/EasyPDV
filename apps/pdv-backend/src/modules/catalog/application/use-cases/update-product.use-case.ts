import { Inject, Injectable } from "@nestjs/common";
import type { UpdateProductInput } from "@easypdv/shared-validation";
import { ProductNotFoundError } from "../../domain/errors.js";
import type { Product } from "../../domain/entities/product.entity.js";
import { PRODUCT_REPOSITORY, type ProductRepositoryPort } from "../ports/product-repository.port.js";

@Injectable()
export class UpdateProductUseCase {
  constructor(@Inject(PRODUCT_REPOSITORY) private readonly productRepository: ProductRepositoryPort) {}

  async execute(id: string, input: UpdateProductInput): Promise<Product> {
    const existing = await this.productRepository.findById(id);
    if (!existing) {
      throw new ProductNotFoundError(id);
    }
    return this.productRepository.update(id, input);
  }
}
