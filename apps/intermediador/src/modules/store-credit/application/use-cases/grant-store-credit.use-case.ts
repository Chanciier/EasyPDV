import { Inject, Injectable } from "@nestjs/common";
import type { GrantStoreCreditInput } from "@easypdv/shared-validation";
import { StoreCreditItemDiscountExceedsLineTotalError } from "../../domain/errors.js";
import {
  STORE_CREDIT_REPOSITORY,
  type StoreCreditGrantItemData,
  type StoreCreditGrantResult,
  type StoreCreditRepositoryPort,
} from "../ports/store-credit-repository.port.js";

export interface GrantStoreCreditContext {
  organizationId: string;
  storeId: string | null;
  terminalId: string | null;
}

/**
 * Gera crédito de troca — sempre recalcula `totalAmount` de cada item no
 * backend (`quantity*unitPrice - discountAmount`), nunca confia em valor
 * vindo do cliente (mesmo motivo de ItemDiscountExceedsLineTotalError em
 * ApplyItemDiscountUseCase). O total do crédito é a soma dos itens.
 */
@Injectable()
export class GrantStoreCreditUseCase {
  constructor(@Inject(STORE_CREDIT_REPOSITORY) private readonly storeCreditRepository: StoreCreditRepositoryPort) {}

  async execute(context: GrantStoreCreditContext, input: GrantStoreCreditInput): Promise<StoreCreditGrantResult> {
    const items: StoreCreditGrantItemData[] = input.items.map((item) => {
      const lineTotal = item.quantity * item.unitPrice;
      if (item.discountAmount > lineTotal) {
        throw new StoreCreditItemDiscountExceedsLineTotalError(item.productSku, item.discountAmount, lineTotal);
      }
      return {
        productSku: item.productSku,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountAmount: item.discountAmount,
        totalAmount: lineTotal - item.discountAmount,
        restock: item.restock,
      };
    });

    const totalAmount = items.reduce((sum, item) => sum + item.totalAmount, 0);

    return this.storeCreditRepository.grant({
      organizationId: context.organizationId,
      customerCpf: input.document,
      customerName: input.customerName ?? null,
      customerPhone: input.customerPhone ?? null,
      storeId: context.storeId,
      terminalId: context.terminalId,
      totalAmount,
      items,
    });
  }
}
