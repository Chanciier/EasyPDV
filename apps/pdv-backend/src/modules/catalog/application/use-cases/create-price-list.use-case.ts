import { Inject, Injectable } from "@nestjs/common";
import {
  PRICE_LIST_REPOSITORY,
  type PriceListRecord,
  type PriceListRepositoryPort,
} from "../ports/price-list-repository.port.js";

@Injectable()
export class CreatePriceListUseCase {
  constructor(@Inject(PRICE_LIST_REPOSITORY) private readonly priceListRepository: PriceListRepositoryPort) {}

  execute(name: string): Promise<PriceListRecord> {
    return this.priceListRepository.create(name);
  }
}
