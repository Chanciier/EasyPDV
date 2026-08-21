import { Inject, Injectable } from "@nestjs/common";
import { SaleNotEditableError, SaleNotFoundError } from "../../domain/errors.js";
import type { Sale } from "../../domain/entities/sale.entity.js";
import { SALE_REPOSITORY, type SaleRepositoryPort } from "../ports/sale-repository.port.js";

/** Pagamento dividido (2026-08-21) — mesmo formato de RemoveSaleItemUseCase. */
@Injectable()
export class RemovePaymentUseCase {
  constructor(@Inject(SALE_REPOSITORY) private readonly saleRepository: SaleRepositoryPort) {}

  async execute(saleId: string, paymentId: string): Promise<Sale> {
    const sale = await this.saleRepository.findById(saleId);
    if (!sale) {
      throw new SaleNotFoundError(saleId);
    }
    if (!sale.canBeModified) {
      throw new SaleNotEditableError(saleId);
    }
    return this.saleRepository.removePayment(saleId, paymentId);
  }
}
