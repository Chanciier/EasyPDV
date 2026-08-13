import { Inject, Injectable } from "@nestjs/common";
import { SaleNotFoundError } from "../../domain/errors.js";
import type { Sale } from "../../domain/entities/sale.entity.js";
import { SALE_REPOSITORY, type SaleRepositoryPort } from "../ports/sale-repository.port.js";

@Injectable()
export class GetSaleUseCase {
  constructor(@Inject(SALE_REPOSITORY) private readonly saleRepository: SaleRepositoryPort) {}

  async execute(id: string): Promise<Sale> {
    const sale = await this.saleRepository.findById(id);
    if (!sale) {
      throw new SaleNotFoundError(id);
    }
    return sale;
  }
}
