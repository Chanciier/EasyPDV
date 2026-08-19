import { Inject, Injectable } from "@nestjs/common";
import type { RegisterPaymentInput } from "@easypdv/shared-validation";
import { SaleNotEditableError, SaleNotFoundError } from "../../domain/errors.js";
import type { Sale } from "../../domain/entities/sale.entity.js";
import { SALE_REPOSITORY, type SaleRepositoryPort } from "../ports/sale-repository.port.js";
import {
  AUDIT_LOG_REPOSITORY,
  type AuditLogRepositoryPort,
} from "../../../audit/application/ports/audit-log-repository.port.js";

/**
 * V1 não tem TEF/gateway real — o operador declara que a maquininha física
 * (ou o dinheiro em mãos) já aprovou, e o pagamento entra direto como
 * aprovado. Ver docs/ROADMAP.md.
 */
@Injectable()
export class RegisterPaymentUseCase {
  constructor(
    @Inject(SALE_REPOSITORY) private readonly saleRepository: SaleRepositoryPort,
    @Inject(AUDIT_LOG_REPOSITORY) private readonly auditLogRepository: AuditLogRepositoryPort,
  ) {}

  async execute(saleId: string, input: RegisterPaymentInput, actorUserId: string | null): Promise<Sale> {
    const sale = await this.saleRepository.findById(saleId);
    if (!sale) {
      throw new SaleNotFoundError(saleId);
    }
    if (!sale.canBeModified) {
      throw new SaleNotEditableError(saleId);
    }

    /**
     * Bug real, achado numa venda de verdade (2026-08-18): a tela de Venda faz
     * `registerPayment` e logo em seguida `confirm` — se o CONFIRM falhar (foi
     * o caso: loja sem depósito cadastrado, ver ensureDefaultWarehouse em
     * main.ts), o pagamento já ficou gravado. O operador clica "Confirmar" de
     * novo e um SEGUNDO Payment é criado pro mesmo valor: a venda de R$14,99
     * ficou com 2 pagamentos de R$14,99 (R$29,98 no total). Estraga duas
     * coisas reais a jusante: `sumCashPayments` (fechamento de caixa passa a
     * esperar o dobro em dinheiro) e o payload de sync pro Bling (parcelas
     * somando mais que o total do pedido). Sair sem fazer nada quando a venda
     * JÁ está integralmente paga deixa esse retry idempotente — a segunda
     * tentativa de confirmar segue normalmente, sem duplicar o pagamento.
     * V1 não tem pagamento parcial/split na tela, então "já pago = não
     * registra de novo" não bloqueia nenhum fluxo legítimo.
     */
    if (sale.isFullyPaid) {
      return sale;
    }

    const updated = await this.saleRepository.registerPayment({
      saleId,
      method: input.method,
      amount: input.amount,
      cardType: input.cardType ?? null,
      installments: input.installments ?? null,
      authorizationCode: input.authorizationCode ?? null,
    });
    await this.auditLogRepository.record({
      userId: actorUserId,
      action: "payment.registered",
      entityType: "sale",
      entityId: saleId,
      metadata: { method: input.method, amount: input.amount, cardType: input.cardType ?? null, installments: input.installments ?? null },
    });
    return updated;
  }
}
