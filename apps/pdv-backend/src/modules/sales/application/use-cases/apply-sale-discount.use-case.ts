import { Inject, Injectable } from "@nestjs/common";
import { DiscountExceedsSaleTotalError, SaleNotEditableError, SaleNotFoundError } from "../../domain/errors.js";
import type { Sale } from "../../domain/entities/sale.entity.js";
import { SALE_REPOSITORY, type SaleRepositoryPort } from "../ports/sale-repository.port.js";
import {
  AUDIT_LOG_REPOSITORY,
  type AuditLogRepositoryPort,
} from "../../../audit/application/ports/audit-log-repository.port.js";

@Injectable()
export class ApplySaleDiscountUseCase {
  constructor(
    @Inject(SALE_REPOSITORY) private readonly saleRepository: SaleRepositoryPort,
    @Inject(AUDIT_LOG_REPOSITORY) private readonly auditLogRepository: AuditLogRepositoryPort,
  ) {}

  async execute(saleId: string, discountAmount: number, actorUserId: string | null): Promise<Sale> {
    const sale = await this.saleRepository.findById(saleId);
    if (!sale) {
      throw new SaleNotFoundError(saleId);
    }
    if (!sale.canBeModified) {
      throw new SaleNotEditableError(saleId);
    }
    const subtotal = sale.totalAmount + sale.discountAmount;
    if (discountAmount > subtotal) {
      throw new DiscountExceedsSaleTotalError(saleId, discountAmount, subtotal);
    }
    const previousTotal = sale.totalAmount;
    const updated = await this.saleRepository.applyDiscount(saleId, discountAmount);
    await this.auditLogRepository.record({
      userId: actorUserId,
      action: "sale.discount_applied",
      entityType: "sale",
      entityId: saleId,
      metadata: { discountAmount, previousTotal, newTotal: updated.totalAmount },
    });
    return updated;
  }
}
