import { Inject, Injectable } from "@nestjs/common";
import type { RedeemStoreCreditInput } from "@easypdv/shared-validation";
import { InsufficientStoreCreditError } from "../../domain/errors.js";
import { STORE_CREDIT_REPOSITORY, type StoreCreditRepositoryPort } from "../ports/store-credit-repository.port.js";

export interface RedeemStoreCreditContext {
  organizationId: string;
  storeId: string | null;
  terminalId: string | null;
}

@Injectable()
export class RedeemStoreCreditUseCase {
  constructor(@Inject(STORE_CREDIT_REPOSITORY) private readonly storeCreditRepository: StoreCreditRepositoryPort) {}

  async execute(context: RedeemStoreCreditContext, input: RedeemStoreCreditInput): Promise<{ balance: number }> {
    const result = await this.storeCreditRepository.redeem({
      organizationId: context.organizationId,
      customerCpf: input.document,
      amount: input.amount,
      storeId: context.storeId,
      terminalId: context.terminalId,
      saleReference: input.saleReference ?? null,
    });
    if (!result) {
      throw new InsufficientStoreCreditError(input.document);
    }
    return result;
  }
}
