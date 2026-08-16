import type { PaymentCardType, PaymentMethod, SaleStatus } from "@easypdv/shared-types";
import type { Sale } from "../../domain/entities/sale.entity.js";

export interface StartSaleData {
  cashSessionId: string;
  operatorUserId: string;
  customerId: string | null;
}

export interface AddSaleItemData {
  saleId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface RegisterPaymentData {
  saleId: string;
  method: PaymentMethod;
  amount: number;
  cardType: PaymentCardType | null;
  installments: number | null;
  authorizationCode: string | null;
}

export interface SaleRepositoryPort {
  findById(id: string): Promise<Sale | null>;
  /** Histórico (Sprint 9) — mais recente primeiro. */
  findMany(params?: { status?: SaleStatus; cashSessionId?: string; limit?: number }): Promise<Sale[]>;
  start(data: StartSaleData): Promise<Sale>;
  addItem(data: AddSaleItemData): Promise<Sale>;
  removeItem(saleId: string, itemId: string): Promise<Sale>;
  cancel(id: string): Promise<Sale>;
  /** Desconto fixo (R$) no total da venda — recalcula totalAmount = max(0, subtotal - discountAmount). */
  applyDiscount(saleId: string, discountAmount: number): Promise<Sale>;
  registerPayment(data: RegisterPaymentData): Promise<Sale>;
  /**
   * Confirma a venda e debita o estoque no `warehouseId` informado, tudo
   * numa única transação Prisma — é o "evento central" do sistema. Ver
   * docs/DATABASE.md. O débito usa `decrement` atômico (não read-modify-write),
   * o que resolve a race condition de concorrência documentada desde a Sprint 3.
   * `actorUserId` grava um AuditLog (action "sale.confirmed") na MESMA
   * transação — único ponto de auditoria com essa garantia (Sprint 13).
   */
  confirm(saleId: string, warehouseId: string, actorUserId: string | null): Promise<Sale>;
  /** Soma pagamentos "dinheiro" aprovados de vendas confirmadas na sessão — usado no fechamento de caixa (Sprint 9). */
  sumCashPayments(cashSessionId: string): Promise<number>;
  /**
   * Estorna uma venda confirmada (Sprint 14): reverte o débito de estoque
   * original via StockMovement compensatório (type "devolucao", quantidade
   * positiva) no MESMO depósito debitado por confirm() — derivado das
   * StockMovement originais da venda, não de "o primeiro depósito". Reaproveita
   * SaleStatus "cancelled" (distinção com cancelamento de rascunho via
   * confirmedAt !== null). AuditLog "sale.voided" na MESMA transação, mesma
   * régua de rigor de confirm()/"sale.confirmed".
   */
  voidConfirmed(saleId: string, actorUserId: string | null, reason: string): Promise<Sale>;
}

export const SALE_REPOSITORY = Symbol("SALE_REPOSITORY");
