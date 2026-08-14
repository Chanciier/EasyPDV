import { Inject, Injectable } from "@nestjs/common";
import { PRICE_LIST_REPOSITORY, type PriceListRecord, type PriceListRepositoryPort } from "../ports/price-list-repository.port.js";

@Injectable()
export class GetActivePriceListUseCase {
  constructor(@Inject(PRICE_LIST_REPOSITORY) private readonly priceListRepository: PriceListRepositoryPort) {}

  execute(): Promise<PriceListRecord | null> {
    return this.priceListRepository.findActive();
  }
}
