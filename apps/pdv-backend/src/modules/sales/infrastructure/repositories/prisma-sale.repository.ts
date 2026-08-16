import { Injectable } from "@nestjs/common";
import type { SaleStatus, SaleSyncPayload } from "@easypdv/shared-types";
import { Sale } from "../../domain/entities/sale.entity.js";
import { SaleWarehouseNotResolvableError } from "../../domain/errors.js";
import { PrismaService } from "../../../../prisma/prisma.service.js";
import type {
  AddSaleItemData,
  RegisterPaymentData,
  SaleRepositoryPort,
  StartSaleData,
} from "../../application/ports/sale-repository.port.js";
import { toDomainSale } from "../mappers/sales.mapper.js";

const SALE_INCLUDE = { items: true, payments: true } as const;

@Injectable()
export class PrismaSaleRepository implements SaleRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Sale | null> {
    const record = await this.prisma.sale.findUnique({ where: { id }, include: SALE_INCLUDE });
    return record ? toDomainSale(record) : null;
  }

  async findMany(params?: { status?: SaleStatus; cashSessionId?: string; limit?: number }): Promise<Sale[]> {
    const records = await this.prisma.sale.findMany({
      where: {
        status: params?.status,
        cashSessionId: params?.cashSessionId,
      },
      include: SALE_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: params?.limit ?? 100,
    });
    return records.map(toDomainSale);
  }

  async start(data: StartSaleData): Promise<Sale> {
    const record = await this.prisma.sale.create({
      data: {
        cashSessionId: data.cashSessionId,
        operatorUserId: data.operatorUserId,
        customerId: data.customerId,
      },
      include: SALE_INCLUDE,
    });
    return toDomainSale(record);
  }

  async addItem(data: AddSaleItemData): Promise<Sale> {
    const totalAmount = data.quantity * data.unitPrice;
    await this.prisma.saleItem.create({
      data: {
        saleId: data.saleId,
        productId: data.productId,
        quantity: data.quantity,
        unitPrice: data.unitPrice,
        totalAmount,
      },
    });
    return this.recalculateTotal(data.saleId);
  }

  async removeItem(saleId: string, itemId: string): Promise<Sale> {
    await this.prisma.saleItem.delete({ where: { id: itemId } });
    return this.recalculateTotal(saleId);
  }

  async applyDiscount(saleId: string, discountAmount: number): Promise<Sale> {
    await this.prisma.sale.update({ where: { id: saleId }, data: { discountAmount } });
    return this.recalculateTotal(saleId);
  }

  async cancel(id: string): Promise<Sale> {
    const record = await this.prisma.sale.update({
      where: { id },
      data: { status: "cancelled" },
      include: SALE_INCLUDE,
    });
    return toDomainSale(record);
  }

  async registerPayment(data: RegisterPaymentData): Promise<Sale> {
    await this.prisma.payment.create({
      data: {
        saleId: data.saleId,
        method: data.method,
        amount: data.amount,
        cardType: data.cardType,
        installments: data.installments,
        authorizationCode: data.authorizationCode,
      },
    });
    const record = await this.prisma.sale.findUniqueOrThrow({ where: { id: data.saleId }, include: SALE_INCLUDE });
    return toDomainSale(record);
  }

  /**
   * Confirma a venda, debita o estoque de cada item e grava a entrada de
   * sincronização — tudo na mesma transação. O débito usa `decrement` atômico
   * (SQL `SET quantity = quantity - X`), não um read-modify-write em código
   * de aplicação — combinado com a serialização de escrita do próprio SQLite,
   * isso resolve a race condition de dois caixas confirmando o último item do
   * mesmo produto ao mesmo tempo (risco documentado desde a Sprint 3). O
   * SyncOutbox segue o mesmo raciocínio: se a venda foi commitada, a entrada
   * de sync também foi, sem exceção — grava-se aqui em vez de via
   * SyncOutboxRepositoryPort para não sair do escopo desta transação (mesma
   * exceção pragmática documentada em docs/DATABASE.md).
   */
  async confirm(saleId: string, warehouseId: string, actorUserId: string | null): Promise<Sale> {
    const sale = await this.prisma.sale.findUniqueOrThrow({ where: { id: saleId }, include: SALE_INCLUDE });
    const confirmedAt = new Date();

    const stockOperations = sale.items.flatMap((item) => [
      this.prisma.stockMovement.create({
        data: {
          warehouseId,
          productId: item.productId,
          type: "venda",
          quantity: -item.quantity,
          referenceType: "sale",
          referenceId: saleId,
        },
      }),
      this.prisma.stockItem.upsert({
        where: { warehouseId_productId: { warehouseId, productId: item.productId } },
        create: { warehouseId, productId: item.productId, quantity: -item.quantity },
        update: { quantity: { decrement: item.quantity } },
      }),
    ]);

    // sku/name vêm do Catalog (outro módulo) só pra este payload de sync —
    // o Intermediador nunca acessa o SQLite local, precisa desses dados já
    // "achatados" aqui pra resolver o produto no Bling (ver BlingSyncAdapter).
    const products = await this.prisma.product.findMany({
      where: { id: { in: sale.items.map((item) => item.productId) } },
      select: { id: true, sku: true, name: true },
    });
    const productById = new Map(products.map((product) => [product.id, product]));

    const syncPayload: SaleSyncPayload = {
      saleId,
      totalAmount: sale.totalAmount,
      confirmedAt: confirmedAt.toISOString(),
      items: sale.items.map((item) => {
        const product = productById.get(item.productId);
        return {
          productId: item.productId,
          sku: product?.sku ?? "",
          name: product?.name ?? "",
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        };
      }),
      // Sprint 14 — antes disso o Adapter Bling nunca sabia a forma de
      // pagamento real da venda (usava um id fixo pra tudo via
      // BLING_DEFAULT_PAYMENT_METHOD_ID). Ver BlingSyncTargetAdapter.
      payments: sale.payments.map((payment) => ({
        method: payment.method,
        amount: payment.amount,
        cardType: payment.cardType,
        installments: payment.installments,
      })),
    };

    await this.prisma.$transaction([
      this.prisma.sale.update({
        where: { id: saleId },
        data: { status: "confirmed", confirmedAt },
      }),
      ...stockOperations,
      this.prisma.syncOutbox.create({
        data: { entityType: "sale", entityId: saleId, payload: JSON.stringify(syncPayload) },
      }),
      this.prisma.auditLog.create({
        data: {
          userId: actorUserId,
          action: "sale.confirmed",
          entityType: "sale",
          entityId: saleId,
          metadata: JSON.stringify({ totalAmount: sale.totalAmount, itemCount: sale.items.length }),
        },
      }),
    ]);

    const confirmed = await this.prisma.sale.findUniqueOrThrow({ where: { id: saleId }, include: SALE_INCLUDE });
    return toDomainSale(confirmed);
  }

  /**
   * Estorna uma venda confirmada — espelha a transação de confirm() (mesma
   * régua de rigor: dinheiro + estoque em jogo dos dois lados). O depósito
   * de cada item é derivado das StockMovement "venda" originais (não "o
   * primeiro depósito" como confirm() faz ao debitar pela primeira vez) —
   * mais correto e já preparado pra um cenário multi-depósito futuro.
   */
  async voidConfirmed(saleId: string, actorUserId: string | null, reason: string): Promise<Sale> {
    const sale = await this.prisma.sale.findUniqueOrThrow({ where: { id: saleId }, include: SALE_INCLUDE });

    const originalMovements = await this.prisma.stockMovement.findMany({
      where: { referenceType: "sale", referenceId: saleId, type: "venda" },
      select: { warehouseId: true, productId: true },
    });
    if (originalMovements.length === 0) {
      throw new SaleWarehouseNotResolvableError(saleId);
    }
    const warehouseByProduct = new Map(originalMovements.map((m) => [m.productId, m.warehouseId]));

    const stockOperations = sale.items.flatMap((item) => {
      const warehouseId = warehouseByProduct.get(item.productId);
      if (!warehouseId) {
        throw new SaleWarehouseNotResolvableError(saleId);
      }
      return [
        this.prisma.stockMovement.create({
          data: {
            warehouseId,
            productId: item.productId,
            type: "devolucao",
            quantity: item.quantity,
            referenceType: "sale",
            referenceId: saleId,
          },
        }),
        this.prisma.stockItem.upsert({
          where: { warehouseId_productId: { warehouseId, productId: item.productId } },
          create: { warehouseId, productId: item.productId, quantity: item.quantity },
          update: { quantity: { increment: item.quantity } },
        }),
      ];
    });

    await this.prisma.$transaction([
      this.prisma.sale.update({ where: { id: saleId }, data: { status: "cancelled" } }),
      ...stockOperations,
      this.prisma.auditLog.create({
        data: {
          userId: actorUserId,
          action: "sale.voided",
          entityType: "sale",
          entityId: saleId,
          metadata: JSON.stringify({ reason, totalAmount: sale.totalAmount, itemCount: sale.items.length }),
        },
      }),
    ]);

    const voided = await this.prisma.sale.findUniqueOrThrow({ where: { id: saleId }, include: SALE_INCLUDE });
    return toDomainSale(voided);
  }

  async sumCashPayments(cashSessionId: string): Promise<number> {
    const result = await this.prisma.payment.aggregate({
      where: {
        method: "dinheiro",
        status: "aprovado",
        sale: { cashSessionId, status: "confirmed" },
      },
      _sum: { amount: true },
    });
    return result._sum.amount ?? 0;
  }

  /**
   * totalAmount = max(0, subtotal dos itens - discountAmount). Roda a cada
   * addItem/removeItem/applyDiscount — precisa reler o discountAmount atual
   * da venda a cada chamada, senão adicionar/remover um item depois de um
   * desconto aplicado apagaria o desconto silenciosamente (bug real corrigido
   * nesta sprint: a versão anterior ignorava discountAmount por completo).
   */
  private async recalculateTotal(saleId: string): Promise<Sale> {
    const [items, sale] = await Promise.all([
      this.prisma.saleItem.findMany({ where: { saleId } }),
      this.prisma.sale.findUniqueOrThrow({ where: { id: saleId } }),
    ]);
    const subtotal = items.reduce((sum, item) => sum + item.totalAmount, 0);
    const totalAmount = Math.max(0, subtotal - sale.discountAmount);
    const record = await this.prisma.sale.update({
      where: { id: saleId },
      data: { totalAmount },
      include: SALE_INCLUDE,
    });
    return toDomainSale(record);
  }
}
