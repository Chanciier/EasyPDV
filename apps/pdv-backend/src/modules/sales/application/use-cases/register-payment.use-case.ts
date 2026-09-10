import { Inject, Injectable } from "@nestjs/common";
import type { RegisterPaymentInput } from "@easypdv/shared-validation";
import {
  InsufficientStoreCreditError,
  PaymentExceedsRemainingAmountError,
  SaleNotEditableError,
  SaleNotFoundError,
  StoreCreditRedemptionRequiresCustomerError,
} from "../../domain/errors.js";
import type { Sale } from "../../domain/entities/sale.entity.js";
import { SALE_REPOSITORY, type SaleRepositoryPort } from "../ports/sale-repository.port.js";
import {
  AUDIT_LOG_REPOSITORY,
  type AuditLogRepositoryPort,
} from "../../../audit/application/ports/audit-log-repository.port.js";
import {
  CUSTOMER_REPOSITORY,
  type CustomerRepositoryPort,
} from "../../../customers/application/ports/customer-repository.port.js";
import { STORE_CREDIT_GATEWAY, type StoreCreditGatewayPort } from "../../../store-credit/application/ports/store-credit-gateway.port.js";

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
    @Inject(CUSTOMER_REPOSITORY) private readonly customerRepository: CustomerRepositoryPort,
    @Inject(STORE_CREDIT_GATEWAY) private readonly storeCreditGateway: StoreCreditGatewayPort,
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
     * Continua valendo com pagamento dividido (2026-08-21): essa guarda só
     * dispara quando a venda JÁ está 100% paga, então cobre o retry-depois-do-
     * último-pagamento; cada perna individual é registrada e confirmada pelo
     * próprio operador na tela (payment-dialog.tsx), nunca reenviada em lote.
     */
    if (sale.isFullyPaid) {
      return sale;
    }

    // Pagamento dividido (2026-08-21): cada perna é registrada na hora, então
    // precisa impedir que uma perna sozinha ultrapasse o que ainda falta —
    // sem isso, duas pernas poderiam somar mais que o total da venda.
    if (input.amount > sale.remainingAmount) {
      throw new PaymentExceedsRemainingAmountError(saleId, input.amount, sale.remainingAmount);
    }

    /**
     * Vale-Troca (Fase 3, 2026-09-10) — checagem antecipada aqui, mas só
     * consultiva (feedback rápido pro operador, mesmo espírito das outras
     * guardas desta tela). O débito de verdade contra o saldo central só
     * acontece em ConfirmSaleUseCase, no mesmo instante em que o estoque é
     * debitado (evento central da venda) — nunca aqui, porque cada perna de
     * pagamento pode ainda ser removida (botão de lixeira em
     * payment-dialog.tsx) antes de confirmar; debitar o saldo do cliente
     * numa perna que depois é descartada deixaria crédito real perdido sem
     * venda nenhuma pra mostrar por trás.
     */
    if (input.method === "vale_troca") {
      if (!sale.customerId) {
        throw new StoreCreditRedemptionRequiresCustomerError(saleId);
      }
      const customer = await this.customerRepository.findById(sale.customerId);
      if (!customer?.document) {
        throw new StoreCreditRedemptionRequiresCustomerError(saleId);
      }
      const balance = await this.storeCreditGateway.getBalance(customer.document);
      if (balance !== null) {
        const alreadyRedeemed = sale.payments
          .filter((p) => p.status === "aprovado" && p.method === "vale_troca")
          .reduce((sum, p) => sum + p.amount, 0);
        if (alreadyRedeemed + input.amount > balance + 0.001) {
          throw new InsufficientStoreCreditError(customer.document);
        }
      }
    }

    const updated = await this.saleRepository.registerPayment({
      saleId,
      method: input.method,
      amount: input.amount,
      cardType: input.cardType ?? null,
      cardBrand: input.cardBrand ?? null,
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
