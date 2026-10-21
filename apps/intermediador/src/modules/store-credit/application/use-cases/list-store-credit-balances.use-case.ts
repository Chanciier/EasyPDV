import { Inject, Injectable } from "@nestjs/common";
import {
  STORE_CREDIT_REPOSITORY,
  type StoreCreditBalanceRow,
  type StoreCreditRepositoryPort,
} from "../ports/store-credit-repository.port.js";

@Injectable()
export class ListStoreCreditBalancesUseCase {
  constructor(@Inject(STORE_CREDIT_REPOSITORY) private readonly storeCreditRepository: StoreCreditRepositoryPort) {}

  execute(organizationId: string, query?: string): Promise<StoreCreditBalanceRow[]> {
    return this.storeCreditRepository.listBalances(organizationId, query);
  }
}
