import { Inject, Injectable } from "@nestjs/common";
import type { UpdateSaleItemQuantityInput } from "@easypdv/shared-validation";
import {
  ItemDiscountExceedsLineTotalError,
  SaleItemNotFoundError,
  SaleNotEditableError,
  SaleNotFoundError,
} from "../../domain/errors.js";
import type { Sale } from "../../domain/entities/sale.entity.js";
import { SALE_REPOSITORY, type SaleRepositoryPort } from "../ports/sale-repository.port.js";
import {
  AUDIT_LOG_REPOSITORY,
  type AuditLogRepositoryPort,
} from "../../../audit/application/ports/audit-log-repository.port.js";

/** Compara em centavos — evita recusar por resíduo de ponto flutuante (ex.: 3 × 9,99). */
function toCents(value: number): number {
  return Math.round(value * 100);
}

/**
 * Muda a quantidade de um item (2026-10-22, PERF-03c). Antes o frontend
 * fazia DELETE + POST: 2 requisições e o item ganhava id novo, perdendo o
 * desconto de clube já decidido. Aqui o item mantém `id` e o `unitPrice`
 * gravado (preço nunca vem do cliente).
 *
 * Desconto (regra de ux-revisao §2 + K2):
 * - sem `discountAmount` no body → mantém o desconto em R$ limitado ao novo
 *   subtotal da linha (`min(desconto, qtd × unitPrice)`) — decisão de
 *   2026-09-01, desconto manual "fica um valor FIXO, não recalcula sozinho";
 * - com `discountAmount` → o frontend está reaplicando o % de clube sobre a
 *   nova quantidade; se exceder o novo subtotal é erro (não corta calado).
 * Trilha em `sale.item_quantity_changed` com antes/depois.
 */
@Injectable()
export class UpdateSaleItemQuantityUseCase {
  constructor(
    @Inject(SALE_REPOSITORY) private readonly saleRepository: SaleRepositoryPort,
    @Inject(AUDIT_LOG_REPOSITORY) private readonly auditLogRepository: AuditLogRepositoryPort,
  ) {}

  async execute(
    saleId: string,
    itemId: string,
    input: UpdateSaleItemQuantityInput,
    actorUserId: string | null,
  ): Promise<Sale> {
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

    const newSubtotal = input.quantity * item.unitPrice;
    let newDiscount: number;
    if (input.discountAmount !== undefined) {
      if (toCents(input.discountAmount) > toCents(newSubtotal)) {
        throw new ItemDiscountExceedsLineTotalError(itemId, input.discountAmount, newSubtotal);
      }
      newDiscount = Math.min(input.discountAmount, newSubtotal);
    } else {
      newDiscount = Math.max(0, Math.min(item.discountAmount, newSubtotal));
    }

    const updated = await this.saleRepository.updateItemQuantity(saleId, itemId, input.quantity, newDiscount);
    await this.auditLogRepository.record({
      userId: actorUserId,
      action: "sale.item_quantity_changed",
      entityType: "sale",
      entityId: saleId,
      metadata: {
        itemId,
        productId: item.productId,
        previousQuantity: item.quantity,
        newQuantity: input.quantity,
        previousDiscount: item.discountAmount,
        newDiscount,
      },
    });
    return updated;
  }
}
