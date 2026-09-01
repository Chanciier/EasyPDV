import { Inject, Injectable } from "@nestjs/common";
import {
  AUDIT_LOG_REPOSITORY,
  type AuditLogRepositoryPort,
} from "../../../audit/application/ports/audit-log-repository.port.js";
import {
  CUSTOMER_REPOSITORY,
  type CustomerRepositoryPort,
} from "../../../customers/application/ports/customer-repository.port.js";
import { CLUB_GATEWAY, type ClubGatewayPort } from "../../../club/application/ports/club-gateway.port.js";
import { ClubDiscountBlockedByManualError, SaleHasNoCustomerError, SaleNotEditableError, SaleNotFoundError } from "../../domain/errors.js";
import type { Sale } from "../../domain/entities/sale.entity.js";
import { SALE_REPOSITORY, type SaleRepositoryPort } from "../ports/sale-repository.port.js";

/**
 * Chamado pelo PDV logo depois do CPF ser anexado no início da venda (ver
 * plano seção 5.1/5.2). Até 2026-09-02 aplicava 30% fixo sobre o subtotal da
 * venda inteira (`Sale.discountAmount`); a partir daqui só MARCA a venda
 * como de sócio (`discountSource: "club"`, `discountAmount` sempre 0) — o
 * desconto de verdade passou a ser por item (10%-90%, escolhido na hora de
 * bipar cada produto, com 30% de fallback — ver `AddSaleItemUseCase` e
 * `ApplyItemDiscountUseCase` no frontend/sale-view.tsx). Como o CPF é pedido
 * ANTES do primeiro item (CpfGateDialog), o carrinho está sempre vazio aqui
 * na prática — não precisa aplicar nada em itens existentes.
 */
@Injectable()
export class ApplyClubDiscountUseCase {
  constructor(
    @Inject(SALE_REPOSITORY) private readonly saleRepository: SaleRepositoryPort,
    @Inject(CUSTOMER_REPOSITORY) private readonly customerRepository: CustomerRepositoryPort,
    @Inject(CLUB_GATEWAY) private readonly clubGateway: ClubGatewayPort,
    @Inject(AUDIT_LOG_REPOSITORY) private readonly auditLogRepository: AuditLogRepositoryPort,
  ) {}

  async execute(saleId: string, actorUserId: string | null): Promise<Sale> {
    const sale = await this.saleRepository.findById(saleId);
    if (!sale) {
      throw new SaleNotFoundError(saleId);
    }
    if (!sale.canBeModified) {
      throw new SaleNotEditableError(saleId);
    }
    if (sale.discountSource === "manual") {
      throw new ClubDiscountBlockedByManualError(saleId);
    }
    if (!sale.customerId) {
      throw new SaleHasNoCustomerError(saleId);
    }

    const customer = await this.customerRepository.findById(sale.customerId);
    if (!customer?.document) {
      return sale;
    }

    let isMember: boolean;
    try {
      isMember = (await this.clubGateway.checkStatus(customer.document)) ?? false;
    } catch {
      isMember = false;
    }
    if (!isMember) {
      return sale;
    }

    const updated = await this.saleRepository.applyDiscount(saleId, 0, "club");
    await this.auditLogRepository.record({
      userId: actorUserId,
      action: "sale.club_discount_applied",
      entityType: "sale",
      entityId: saleId,
      metadata: {},
    });
    return updated;
  }
}
