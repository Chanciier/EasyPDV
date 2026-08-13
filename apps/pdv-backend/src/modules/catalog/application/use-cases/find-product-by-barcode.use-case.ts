import { Inject, Injectable } from "@nestjs/common";
import { ProductNotFoundError } from "../../domain/errors.js";
import type { Product } from "../../domain/entities/product.entity.js";
import { PRODUCT_REPOSITORY, type ProductRepositoryPort } from "../ports/product-repository.port.js";

/** Caminho quente do PDV — busca por leitura de código de barras. Ver docs/FRONTEND.md. */
@Injectable()
export class FindProductByBarcodeUseCase {
  constructor(@Inject(PRODUCT_REPOSITORY) private readonly productRepository: ProductRepositoryPort) {}

  async execute(code: string): Promise<Product> {
    const product = await this.productRepository.findByBarcode(code);
    if (!product) {
      throw new ProductNotFoundError(code);
    }
    return product;
  }
}
