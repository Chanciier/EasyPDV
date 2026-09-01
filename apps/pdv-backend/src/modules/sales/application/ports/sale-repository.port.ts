import type { PaymentCardBrand, PaymentCardType, PaymentMethod, SaleDiscountSource, SaleStatus } from "@easypdv/shared-types";
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
  cardBrand: PaymentCardBrand | null;
  installments: number | null;
  authorizationCode: string | null;
}

export interface SaleRepositoryPort {
  findById(id: string): Promise<Sale | null>;
  /** Histórico (Sprint 9) — mais recente primeiro. */
  findMany(params?: { status?: SaleStatus | SaleStatus[]; cashSessionId?: string; limit?: number }): Promise<Sale[]>;
  start(data: StartSaleData): Promise<Sale>;
  addItem(data: AddSaleItemData): Promise<Sale>;
  removeItem(saleId: string, itemId: string): Promise<Sale>;
  cancel(id: string): Promise<Sale>;
  /**
   * Desconto fixo (R$) no total da venda — recalcula totalAmount = max(0,
   * subtotal - discountAmount). `source` distingue manual (operador) de
   * clube (automático, 30%, recalculado a cada mudança no carrinho — ver
   * ApplyClubDiscountUseCase) — os dois são mutuamente exclusivos.
   */
  applyDiscount(saleId: string, discountAmount: number, source: SaleDiscountSource | null): Promise<Sale>;
  /** Desconto por item (2026-09-01) — recalcula SaleItem.totalAmount = max(0, quantity*unitPrice - discountAmount), independente do desconto da venda inteira (os dois coexistem). */
  applyItemDiscount(saleId: string, itemId: string, discountAmount: number): Promise<Sale>;
  /** "CPF na nota" (2026-08-19) — anexa/troca o cliente de uma venda já iniciada (o seletor da tela de Venda só seta isso no início; o pagamento pode chegar depois). */
  attachCustomer(saleId: string, customerId: string): Promise<Sale>;
  registerPayment(data: RegisterPaymentData): Promise<Sale>;
  /** Pagamento dividido (2026-08-21) — corrige uma perna registrada errado sem precisar reiniciar a venda inteira. */
  removePayment(saleId: string, paymentId: string): Promise<Sale>;
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
