import { Inject, Injectable } from "@nestjs/common";
import {
  ItemDiscountExceedsLineTotalError,
  SaleItemNotFoundError,
  SaleNotEditableError,
  SaleNotFoundError,
} from "../../domain/errors.js";
import { computeClubDiscountAmount } from "../../domain/club-discount.constants.js";
import type { Sale } from "../../domain/entities/sale.entity.js";
import { SALE_REPOSITORY, type SaleRepositoryPort } from "../ports/sale-repository.port.js";
import {
  AUDIT_LOG_REPOSITORY,
  type AuditLogRepositoryPort,
} from "../../../audit/application/ports/audit-log-repository.port.js";

/**
 * Desconto individual por item do carrinho (2026-09-01, pedido do usuário) —
 * independente do desconto da venda inteira (`ApplySaleDiscountUseCase`):
 * os dois coexistem, sem exclusão mútua (ao contrário de manual vs clube, que
 * são mutuamente exclusivos NA VENDA). `discountAmount = 0` remove o desconto
 * desse item.
 */
@Injectable()
export class ApplyItemDiscountUseCase {
  constructor(
    @Inject(SALE_REPOSITORY) private readonly saleRepository: SaleRepositoryPort,
    @Inject(AUDIT_LOG_REPOSITORY) private readonly auditLogRepository: AuditLogRepositoryPort,
  ) {}

  async execute(saleId: string, itemId: string, discountAmount: number, actorUserId: string | null): Promise<Sale> {
    const sale = await this.saleRepository.findById(saleId);
    if (!sale) {
      throw new SaleNotFoundError(saleId);
    }
    if (!sale.canBeModified) {
      throw new SaleNotEditableError(saleId);
    }
    const item = sale.items.find((i) => i.id === itemId);
    if (!item) {
      throw new SaleItemNotFoundError(itemId);
    }
    const lineSubtotal = item.quantity * item.unitPrice;
    if (discountAmount > lineSubtotal) {
      throw new ItemDiscountExceedsLineTotalError(itemId, discountAmount, lineSubtotal);
    }

    const updated = await this.saleRepository.applyItemDiscount(saleId, itemId, discountAmount);
    await this.auditLogRepository.record({
      userId: actorUserId,
      action: "sale.item_discount_applied",
      entityType: "sale",
      entityId: saleId,
      metadata: { itemId, discountAmount },
    });

    // Mesmo recálculo de add/remove-sale-item.use-case.ts — mudar o
    // subtotal de um item muda o subtotal da venda, e o desconto de clube
    // (percentual sobre o subtotal) precisa acompanhar.
    if (updated.discountSource === "club") {
      const subtotal = updated.items.reduce((sum, i) => sum + i.totalAmount, 0);
      return this.saleRepository.applyDiscount(updated.id, computeClubDiscountAmount(subtotal), "club");
    }
    return updated;
  }
}
