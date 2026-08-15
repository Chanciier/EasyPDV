import { Inject, Injectable } from "@nestjs/common";
import type { UpsertPriceListItemInput } from "@easypdv/shared-validation";
import { PriceListNotFoundError, ProductNotFoundError } from "../../domain/errors.js";
import type { PriceListItem } from "../../domain/entities/price-list-item.entity.js";
import { PRICE_LIST_REPOSITORY, type PriceListRepositoryPort } from "../ports/price-list-repository.port.js";
import { PRODUCT_REPOSITORY, type ProductRepositoryPort } from "../ports/product-repository.port.js";
import {
  AUDIT_LOG_REPOSITORY,
  type AuditLogRepositoryPort,
} from "../../../audit/application/ports/audit-log-repository.port.js";

@Injectable()
export class UpsertPriceListItemUseCase {
  constructor(
    @Inject(PRICE_LIST_REPOSITORY) private readonly priceListRepository: PriceListRepositoryPort,
    @Inject(PRODUCT_REPOSITORY) private readonly productRepository: ProductRepositoryPort,
    @Inject(AUDIT_LOG_REPOSITORY) private readonly auditLogRepository: AuditLogRepositoryPort,
  ) {}

  async execute(
    priceListId: string,
    input: UpsertPriceListItemInput,
    actorUserId: string | null,
  ): Promise<PriceListItem> {
    const priceList = await this.priceListRepository.findById(priceListId);
    if (!priceList) {
      throw new PriceListNotFoundError(priceListId);
    }
    const product = await this.productRepository.findById(input.productId);
    if (!product) {
      throw new ProductNotFoundError(input.productId);
    }
    const item = await this.priceListRepository.upsertItem({
      priceListId,
      productId: input.productId,
      price: input.price,
      promotionalPrice: input.promotionalPrice ?? null,
    });
    await this.auditLogRepository.record({
      userId: actorUserId,
      action: "price_list_item.upserted",
      entityType: "product",
      entityId: input.productId,
      metadata: { priceListId, price: input.price, promotionalPrice: input.promotionalPrice ?? null },
    });
    return item;
  }
}
