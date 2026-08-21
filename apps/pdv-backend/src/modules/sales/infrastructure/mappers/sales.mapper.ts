import type {
  CashSession as PrismaCashSession,
  Payment as PrismaPayment,
  Sale as PrismaSale,
  SaleItem as PrismaSaleItem,
} from "@prisma/client";
import { CashSession } from "../../domain/entities/cash-session.entity.js";
import { Payment } from "../../domain/entities/payment.entity.js";
import { Sale, SaleItem } from "../../domain/entities/sale.entity.js";

export function toDomainCashSession(record: PrismaCashSession): CashSession {
  return new CashSession({
    id: record.id,
    cashRegisterId: record.cashRegisterId,
    operatorUserId: record.operatorUserId,
    openingAmount: record.openingAmount,
    closingAmount: record.closingAmount,
    expectedAmount: record.expectedAmount,
    status: record.status,
    openedAt: record.openedAt,
    closedAt: record.closedAt,
  });
}

export function toDomainPayment(record: PrismaPayment): Payment {
  return new Payment({
    id: record.id,
    saleId: record.saleId,
    method: record.method,
    amount: record.amount,
    cardType: record.cardType,
    cardBrand: record.cardBrand,
    installments: record.installments,
    status: record.status,
    authorizationCode: record.authorizationCode,
    createdAt: record.createdAt,
  });
}

type PrismaSaleWithRelations = PrismaSale & { items: PrismaSaleItem[]; payments: PrismaPayment[] };

export function toDomainSale(record: PrismaSaleWithRelations): Sale {
  return new Sale({
    id: record.id,
    cashSessionId: record.cashSessionId,
    operatorUserId: record.operatorUserId,
    customerId: record.customerId,
    status: record.status,
    totalAmount: record.totalAmount,
    discountAmount: record.discountAmount,
    createdAt: record.createdAt,
    confirmedAt: record.confirmedAt,
    items: record.items.map(
      (item) =>
        new SaleItem({
          id: item.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountAmount: item.discountAmount,
          totalAmount: item.totalAmount,
        }),
    ),
    payments: record.payments.map(toDomainPayment),
  });
}
