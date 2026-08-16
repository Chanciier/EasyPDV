import type { SaleStatus } from "@easypdv/shared-types";
import type { Payment } from "./payment.entity.js";

export interface SaleItemProps {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  totalAmount: number;
}

export class SaleItem {
  readonly id: string;
  readonly productId: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly discountAmount: number;
  readonly totalAmount: number;

  constructor(props: SaleItemProps) {
    this.id = props.id;
    this.productId = props.productId;
    this.quantity = props.quantity;
    this.unitPrice = props.unitPrice;
    this.discountAmount = props.discountAmount;
    this.totalAmount = props.totalAmount;
  }
}

export interface SaleProps {
  id: string;
  cashSessionId: string;
  operatorUserId: string;
  customerId: string | null;
  status: SaleStatus;
  totalAmount: number;
  discountAmount: number;
  createdAt: Date;
  confirmedAt: Date | null;
  items: SaleItem[];
  payments: Payment[];
}

export class Sale {
  readonly id: string;
  readonly cashSessionId: string;
  readonly operatorUserId: string;
  readonly customerId: string | null;
  readonly status: SaleStatus;
  readonly totalAmount: number;
  readonly discountAmount: number;
  readonly createdAt: Date;
  readonly confirmedAt: Date | null;
  readonly items: SaleItem[];
  readonly payments: Payment[];

  constructor(props: SaleProps) {
    this.id = props.id;
    this.cashSessionId = props.cashSessionId;
    this.operatorUserId = props.operatorUserId;
    this.customerId = props.customerId;
    this.status = props.status;
    this.totalAmount = props.totalAmount;
    this.discountAmount = props.discountAmount;
    this.createdAt = props.createdAt;
    this.confirmedAt = props.confirmedAt;
    this.items = props.items;
    this.payments = props.payments;
  }

  /** Só é possível alterar itens/pagamentos enquanto a venda está em rascunho. */
  get canBeModified(): boolean {
    return this.status === "draft";
  }

  /** Estorno (Sprint 14) só se aplica a uma venda já confirmada — draft usa cancel() normal. */
  get canBeVoided(): boolean {
    return this.status === "confirmed";
  }

  get approvedPaymentsTotal(): number {
    return this.payments.filter((p) => p.status === "aprovado").reduce((sum, p) => sum + p.amount, 0);
  }

  /** Pagamento aprovado cobre o total — condição pra confirmar. Ver docs/DATABASE.md "evento central". */
  get isFullyPaid(): boolean {
    return this.approvedPaymentsTotal >= this.totalAmount;
  }
}
