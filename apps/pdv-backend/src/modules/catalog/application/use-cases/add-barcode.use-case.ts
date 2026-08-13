import { Inject, Injectable } from "@nestjs/common";
import type { AddBarcodeInput } from "@easypdv/shared-validation";
import { BarcodeAlreadyInUseError, ProductNotFoundError } from "../../domain/errors.js";
import { PRODUCT_REPOSITORY, type ProductRepositoryPort } from "../ports/product-repository.port.js";

@Injectable()
export class AddBarcodeUseCase {
  constructor(@Inject(PRODUCT_REPOSITORY) private readonly productRepository: ProductRepositoryPort) {}

  async execute(productId: string, input: AddBarcodeInput): Promise<void> {
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new ProductNotFoundError(productId);
    }
    const existing = await this.productRepository.findBarcodeByCode(input.code);
    if (existing) {
      throw new BarcodeAlreadyInUseError(input.code);
    }
    await this.productRepository.addBarcode(productId, input.code, input.type);
  }
}
