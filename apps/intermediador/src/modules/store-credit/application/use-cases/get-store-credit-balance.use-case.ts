import { Inject, Injectable } from "@nestjs/common";
import { STORE_CREDIT_REPOSITORY, type StoreCreditRepositoryPort } from "../ports/store-credit-repository.port.js";

@Injectable()
export class GetStoreCreditBalanceUseCase {
  constructor(@Inject(STORE_CREDIT_REPOSITORY) private readonly storeCreditRepository: StoreCreditRepositoryPort) {}

  execute(organizationId: string, document: string): Promise<number> {
    return this.storeCreditRepository.getBalance(organizationId, document);
  }
}
