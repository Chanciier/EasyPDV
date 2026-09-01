import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { SaleDiscountSource, SaleStatus, SaleSyncPayload, SaleVoidSyncPayload } from "@easypdv/shared-types";
import { Sale } from "../../domain/entities/sale.entity.js";
import { InsufficientStockError, SaleWarehouseNotResolvableError } from "../../domain/errors.js";
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async findById(id: string): Promise<Sale | null> {
    const record = await this.prisma.sale.findUnique({ where: { id }, include: SALE_INCLUDE });
    return record ? toDomainSale(record) : null;
  }

  async findMany(params?: { status?: SaleStatus | SaleStatus[]; cashSessionId?: string; limit?: number }): Promise<Sale[]> {
    const records = await this.prisma.sale.findMany({
      where: {
        status: Array.isArray(params?.status) ? { in: params.status } : params?.status,
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

  async applyDiscount(saleId: string, discountAmount: number, source: SaleDiscountSource | null): Promise<Sale> {
    await this.prisma.sale.update({ where: { id: saleId }, data: { discountAmount, discountSource: source } });
    return this.recalculateTotal(saleId);
  }

  async attachCustomer(saleId: string, customerId: string): Promise<Sale> {
    const record = await this.prisma.sale.update({ where: { id: saleId }, data: { customerId }, include: SALE_INCLUDE });
    return toDomainSale(record);
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
        cardBrand: data.cardBrand,
        installments: data.installments,
        authorizationCode: data.authorizationCode,
      },
    });
    const record = await this.prisma.sale.findUniqueOrThrow({ where: { id: data.saleId }, include: SALE_INCLUDE });
    return toDomainSale(record);
  }

  async removePayment(saleId: string, paymentId: string): Promise<Sale> {
    await this.prisma.payment.delete({ where: { id: paymentId } });
    const record = await this.prisma.sale.findUniqueOrThrow({ where: { id: saleId }, include: SALE_INCLUDE });
    return toDomainSale(record);
  }

  /**
   * Confirma a venda, debita o estoque de cada item e grava a entrada de
   * sincronização — tudo na mesma transação. O débito usa `updateMany` com
   * piso (`WHERE quantity >= X`) em vez de um `upsert`/`decrement` cego —
   * pedido direto do usuário (2026-08-19: "não posso ter 5 produtos
   * cadastrados e no fim acabar tendo 6 vendidos"). `updateMany` continua
   * sendo uma escrita atômica (SQL `UPDATE ... WHERE ...`, não um
   * read-modify-write em código de aplicação), então a resolução da race
   * condition de dois caixas confirmando o último item do mesmo produto ao
   * mesmo tempo (risco documentado desde a Sprint 3) continua valendo — a
   * diferença é que agora, se a condição do WHERE não bater (estoque
   * insuficiente OU produto sem `StockItem` nenhum, tratado como 0
   * disponível), `count` vem 0 e a transação inteira é abortada
   * (`InsufficientStockError`, ver domain/errors.ts) em vez de deixar o saldo
   * ir negativo silenciosamente — a MENOS que `ALLOW_NEGATIVE_STOCK=true`
   * (2026-08-26, pedido temporário do usuário), que troca esse piso por um
   * `upsert` incondicional, deixando o saldo ir negativo de propósito (sync
   * com o Bling reflete a mesma baixa, negativa e tudo — precisa ser setada
   * em CADA terminal, `.env` é por-instalação). Precisou virar transação interativa
   * (`async (tx) => ...`) em vez do array de antes — o array não permite
   * inspecionar o resultado de uma operação no meio pra decidir abortar as
   * seguintes. O SyncOutbox segue o mesmo raciocínio de sempre: se a venda
   * foi commitada, a entrada de sync também foi, sem exceção — grava-se aqui
   * em vez de via SyncOutboxRepositoryPort para não sair do escopo desta
   * transação (mesma exceção pragmática documentada em docs/DATABASE.md).
   */
  async confirm(saleId: string, warehouseId: string, actorUserId: string | null): Promise<Sale> {
    const sale = await this.prisma.sale.findUniqueOrThrow({ where: { id: saleId }, include: SALE_INCLUDE });
    const confirmedAt = new Date();

    // sku/name vêm do Catalog (outro módulo) só pra este payload de sync —
    // o Intermediador nunca acessa o SQLite local, precisa desses dados já
    // "achatados" aqui pra resolver o produto no Bling (ver BlingSyncAdapter).
    const products = await this.prisma.product.findMany({
      where: { id: { in: sale.items.map((item) => item.productId) } },
      select: { id: true, sku: true, name: true },
    });
    const productById = new Map(products.map((product) => [product.id, product]));

    // "CPF na nota" (2026-08-19) — venda sem cliente anexado (caso comum,
    // anônima) manda os dois campos null, comportamento idêntico a antes.
    const customer = sale.customerId
      ? await this.prisma.customer.findUnique({ where: { id: sale.customerId }, select: { document: true, name: true } })
      : null;

    const syncPayload: SaleSyncPayload = {
      saleId,
      totalAmount: sale.totalAmount,
      confirmedAt: confirmedAt.toISOString(),
      customerDocument: customer?.document ?? null,
      customerName: customer?.name ?? null,
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
        cardBrand: payment.cardBrand,
        installments: payment.installments,
      })),
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.sale.update({
        where: { id: saleId },
        data: { status: "confirmed", confirmedAt },
      });

      const allowNegativeStock = this.configService.get<string>("ALLOW_NEGATIVE_STOCK") === "true";
      for (const item of sale.items) {
        if (allowNegativeStock) {
          // Sem piso (ALLOW_NEGATIVE_STOCK, 2026-08-26, pedido temporário do
          // usuário) — upsert em vez de updateMany, pra também cobrir o
          // produto sem StockItem nenhum ainda (fica negativo desde já, em
          // vez de abortar por "0 disponível").
          await tx.stockItem.upsert({
            where: { warehouseId_productId: { warehouseId, productId: item.productId } },
            update: { quantity: { decrement: item.quantity } },
            create: { warehouseId, productId: item.productId, quantity: -item.quantity },
          });
        } else {
          const debited = await tx.stockItem.updateMany({
            where: { warehouseId, productId: item.productId, quantity: { gte: item.quantity } },
            data: { quantity: { decrement: item.quantity } },
          });
          if (debited.count === 0) {
            const current = await tx.stockItem.findUnique({
              where: { warehouseId_productId: { warehouseId, productId: item.productId } },
            });
            const product = productById.get(item.productId);
            throw new InsufficientStockError(product?.name ?? item.productId, current?.quantity ?? 0, item.quantity);
          }
        }
        await tx.stockMovement.create({
          data: {
            warehouseId,
            productId: item.productId,
            type: "venda",
            quantity: -item.quantity,
            referenceType: "sale",
            referenceId: saleId,
          },
        });
      }

      await tx.syncOutbox.create({
        data: { entityType: "sale", entityId: saleId, payload: JSON.stringify(syncPayload) },
      });
      await tx.auditLog.create({
        data: {
          userId: actorUserId,
          action: "sale.confirmed",
          entityType: "sale",
          entityId: saleId,
          metadata: JSON.stringify({ totalAmount: sale.totalAmount, itemCount: sale.items.length }),
        },
      });
    });

    const confirmed = await this.prisma.sale.findUniqueOrThrow({ where: { id: saleId }, include: SALE_INCLUDE });
    return toDomainSale(confirmed);
  }

  /**
   * Estorna uma venda confirmada — espelha a transação de confirm() (mesma
   * régua de rigor: dinheiro + estoque em jogo dos dois lados). O depósito
   * de cada item é derivado das StockMovement "venda" originais (não "o
   * primeiro depósito" como confirm() faz ao debitar pela primeira vez) —
   * mais correto e já preparado pra um cenário multi-depósito futuro.
   *
   * Também grava um SyncOutbox "sale_void" (2026-08-19) — achado numa venda
   * real: sem isso, o estoque devolvido aqui é revertido silenciosamente
   * pelo próximo poll incremental Bling→PDV (que trata o Bling como fonte da
   * verdade e nunca soube que essa venda foi cancelada). Ver BlingSyncTargetAdapter.
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

    const products = await this.prisma.product.findMany({
      where: { id: { in: sale.items.map((item) => item.productId) } },
      select: { id: true, sku: true, name: true },
    });
    const productById = new Map(products.map((product) => [product.id, product]));
    const voidPayload: SaleVoidSyncPayload = {
      saleId,
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
    };

    await this.prisma.$transaction([
      this.prisma.sale.update({ where: { id: saleId }, data: { status: "cancelled" } }),
      ...stockOperations,
      this.prisma.syncOutbox.create({
        data: { entityType: "sale_void", entityId: saleId, payload: JSON.stringify(voidPayload) },
      }),
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
