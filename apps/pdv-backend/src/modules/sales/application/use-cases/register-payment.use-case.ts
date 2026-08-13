import { Inject, Injectable } from "@nestjs/common";
import type { RegisterPaymentInput } from "@easypdv/shared-validation";
import { SaleNotEditableError, SaleNotFoundError } from "../../domain/errors.js";
import type { Sale } from "../../domain/entities/sale.entity.js";
import { SALE_REPOSITORY, type SaleRepositoryPort } from "../ports/sale-repository.port.js";

/**
 * V1 não tem TEF/gateway real — o operador declara que a maquininha física
 * (ou o dinheiro em mãos) já aprovou, e o pagamento entra direto como
 * aprovado. Ver docs/ROADMAP.md.
 */
@Injectable()
export class RegisterPaymentUseCase {
  constructor(@Inject(SALE_REPOSITORY) private readonly saleRepository: SaleRepositoryPort) {}

  async execute(saleId: string, input: RegisterPaymentInput): Promise<Sale> {
    const sale = await this.saleRepository.findById(saleId);
    if (!sale) {
      throw new SaleNotFoundError(saleId);
    }
    if (!sale.canBeModified) {
      throw new SaleNotEditableError(saleId);
    }
    return this.saleRepository.registerPayment({
      saleId,
      method: input.method,
      amount: input.amount,
      authorizationCode: input.authorizationCode ?? null,
    });
  }
}
