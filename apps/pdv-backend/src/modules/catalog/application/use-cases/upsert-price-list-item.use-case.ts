import { Inject, Injectable } from "@nestjs/common";
import type { UpsertPriceListItemInput } from "@easypdv/shared-validation";
import { PriceListNotFoundError, ProductNotFoundError } from "../../domain/errors.js";
import type { PriceListItem } from "../../domain/entities/price-list-item.entity.js";
import { PRICE_LIST_REPOSITORY, type PriceListRepositoryPort } from "../ports/price-list-repository.port.js";
import { PRODUCT_REPOSITORY, type ProductRepositoryPort } from "../ports/product-repository.port.js";

@Injectable()
export class UpsertPriceListItemUseCase {
  constructor(
    @Inject(PRICE_LIST_REPOSITORY) private readonly priceListRepository: PriceListRepositoryPort,
    @Inject(PRODUCT_REPOSITORY) private readonly productRepository: ProductRepositoryPort,
  ) {}

  async execute(priceListId: string, input: UpsertPriceListItemInput): Promise<PriceListItem> {
    const priceList = await this.priceListRepository.findById(priceListId);
    if (!priceList) {
      throw new PriceListNotFoundError(priceListId);
    }
    const product = await this.productRepository.findById(input.productId);
    if (!product) {
      throw new ProductNotFoundError(input.productId);
    }
    return this.priceListRepository.upsertItem({
      priceListId,
      productId: input.productId,
      price: input.price,
      promotionalPrice: input.promotionalPrice ?? null,
    });
  }
}
