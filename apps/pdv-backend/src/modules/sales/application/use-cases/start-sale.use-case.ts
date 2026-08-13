import { Inject, Injectable } from "@nestjs/common";
import type { StartSaleInput } from "@easypdv/shared-validation";
import { CashSessionNotFoundError, CashSessionNotOpenError } from "../../domain/errors.js";
import type { Sale } from "../../domain/entities/sale.entity.js";
import { CASH_REPOSITORY, type CashRepositoryPort } from "../ports/cash-repository.port.js";
import { SALE_REPOSITORY, type SaleRepositoryPort } from "../ports/sale-repository.port.js";

@Injectable()
export class StartSaleUseCase {
  constructor(
    @Inject(CASH_REPOSITORY) private readonly cashRepository: CashRepositoryPort,
    @Inject(SALE_REPOSITORY) private readonly saleRepository: SaleRepositoryPort,
  ) {}

  async execute(input: StartSaleInput, operatorUserId: string): Promise<Sale> {
    const session = await this.cashRepository.findSessionById(input.cashSessionId);
    if (!session) {
      throw new CashSessionNotFoundError(input.cashSessionId);
    }
    if (!session.isOpen) {
      throw new CashSessionNotOpenError(input.cashSessionId);
    }
    return this.saleRepository.start({
      cashSessionId: input.cashSessionId,
      operatorUserId,
      customerId: input.customerId ?? null,
    });
  }
}
