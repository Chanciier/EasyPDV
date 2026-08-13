import { Inject, Injectable } from "@nestjs/common";
import type { Product } from "../../domain/entities/product.entity.js";
import { PRODUCT_REPOSITORY, type ProductRepositoryPort } from "../ports/product-repository.port.js";

@Injectable()
export class SearchProductsUseCase {
  constructor(@Inject(PRODUCT_REPOSITORY) private readonly productRepository: ProductRepositoryPort) {}

  execute(query: string): Promise<Product[]> {
    return this.productRepository.search(query);
  }
}
