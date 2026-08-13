import { Inject, Injectable } from "@nestjs/common";
import type { AddSaleItemInput } from "@easypdv/shared-validation";
import { ResolvePriceUseCase } from "../../../catalog/application/use-cases/resolve-price.use-case.js";
import { SaleNotEditableError, SaleNotFoundError } from "../../domain/errors.js";
import type { Sale } from "../../domain/entities/sale.entity.js";
import { SALE_REPOSITORY, type SaleRepositoryPort } from "../ports/sale-repository.port.js";

/**
 * Lê o preço vigente do Catalog via chamada síncrona (leitura entre módulos é
 * permitida — só grava se torna acoplamento indevido). Ver docs/MODULES.md.
 */
@Injectable()
export class AddSaleItemUseCase {
  constructor(
    @Inject(SALE_REPOSITORY) private readonly saleRepository: SaleRepositoryPort,
    private readonly resolvePriceUseCase: ResolvePriceUseCase,
  ) {}

  async execute(saleId: string, input: AddSaleItemInput): Promise<Sale> {
    const sale = await this.saleRepository.findById(saleId);
    if (!sale) {
      throw new SaleNotFoundError(saleId);
    }
    if (!sale.canBeModified) {
      throw new SaleNotEditableError(saleId);
    }

    const resolvedPrice = await this.resolvePriceUseCase.execute(input.productId);

    return this.saleRepository.addItem({
      saleId,
      productId: input.productId,
      quantity: input.quantity,
      unitPrice: resolvedPrice.effectivePrice,
    });
  }
}
