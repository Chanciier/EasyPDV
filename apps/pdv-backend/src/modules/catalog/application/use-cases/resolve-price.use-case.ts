import { Inject, Injectable } from "@nestjs/common";
import type { ResolvedPrice } from "@easypdv/shared-types";
import { NoActivePriceListError, PriceNotSetError } from "../../domain/errors.js";
import { PRICE_LIST_REPOSITORY, type PriceListRepositoryPort } from "../ports/price-list-repository.port.js";

/**
 * Resolve o preço vigente de um produto — caminho quente do PDV (roda a cada
 * item escaneado). Ver docs/ARCHITECTURE.md sobre a necessidade de cache aqui
 * quando o volume justificar (ainda não implementado no Sprint 2).
 */
@Injectable()
export class ResolvePriceUseCase {
  constructor(@Inject(PRICE_LIST_REPOSITORY) private readonly priceListRepository: PriceListRepositoryPort) {}

  async execute(productId: string): Promise<ResolvedPrice> {
    const activePriceList = await this.priceListRepository.findActive();
    if (!activePriceList) {
      throw new NoActivePriceListError();
    }
    const item = await this.priceListRepository.findItem(activePriceList.id, productId);
    if (!item) {
      throw new PriceNotSetError(productId);
    }
    return {
      productId: item.productId,
      price: item.price,
      promotionalPrice: item.promotionalPrice,
      effectivePrice: item.effectivePrice,
    };
  }
}
