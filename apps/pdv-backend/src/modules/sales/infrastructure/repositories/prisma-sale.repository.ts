import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { SaleDiscountSource, SaleSyncPayload, SaleVoidSyncPayload } from "@easypdv/shared-types";
import { Sale } from "../../domain/entities/sale.entity.js";
import { SaleWarehouseNotResolvableError } from "../../domain/errors.js";
import { PrismaService } from "../../../../prisma/prisma.service.js";
import type {
  AddSaleItemData,
  FindSalesParams,
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

  async findMany(params?: FindSalesParams): Promise<Sale[]> {
    const records = await this.prisma.sale.findMany({
      where: {
        status: Array.isArray(params?.status) ? { in: params.status } : params?.status,
        cashSessionId: params?.cashSessionId,
        // Histórico (F6): o estorno preserva confirmedAt, o rascunho
        // abandonado ("Reiniciar venda") nunca teve — assim só sobram
        // confirmadas e estornadas, sem rascunho ocupando o limite de 100.
        confirmedAt: params?.finalizedOnly ? { not: null } : undefined,
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

  /*
   * Mutações do carrinho (2026-10-22, PERF-03b): cada uma roda numa única
   * transação — escreve a linha e recalcula o total juntas. Antes eram dois
   * commits (um fsync a mais por bipe) e um crash entre eles deixava
   * Sale.totalAmount desatualizado.
   */
  addItem(data: AddSaleItemData): Promise<Sale> {
    return this.prisma.$transaction(async (tx) => {
      await tx.saleItem.create({
        data: {
          saleId: data.saleId,
          productId: data.productId,
          quantity: data.quantity,
          unitPrice: data.unitPrice,
          totalAmount: data.quantity * data.unitPrice,
        },
      });
      return this.recalculateTotal(tx, data.saleId);
    });
  }

  removeItem(saleId: string, itemId: string): Promise<Sale> {
    return this.prisma.$transaction(async (tx) => {
      await tx.saleItem.delete({ where: { id: itemId } });
      return this.recalculateTotal(tx, saleId);
    });
  }

  applyDiscount(saleId: string, discountAmount: number, source: SaleDiscountSource | null): Promise<Sale> {
    return this.prisma.$transaction(async (tx) => {
      await tx.sale.update({ where: { id: saleId }, data: { discountAmount, discountSource: source } });
      return this.recalculateTotal(tx, saleId);
    });
  }

  applyItemDiscount(saleId: string, itemId: string, discountAmount: number): Promise<Sale> {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.saleItem.findUniqueOrThrow({ where: { id: itemId } });
      const lineSubtotal = item.quantity * item.unitPrice;
      const totalAmount = Math.max(0, lineSubtotal - discountAmount);
      await tx.saleItem.update({ where: { id: itemId }, data: { discountAmount, totalAmount } });
      return this.recalculateTotal(tx, saleId);
    });
  }

  updateItemQuantity(saleId: string, itemId: string, quantity: number, discountAmount: number): Promise<Sale> {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.saleItem.findUniqueOrThrow({ where: { id: itemId } });
      const totalAmount = Math.max(0, quantity * item.unitPrice - discountAmount);
      await tx.saleItem.update({ where: { id: itemId }, data: { quantity, discountAmount, totalAmount } });
      return this.recalculateTotal(tx, saleId);
    });
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
   * sincronização — tudo na mesma transação.
   *
   * **Estoque negativo permitido (2026-09-01, pedido do usuário, "até
   * segunda ordem")**: até aqui o débito usava `updateMany` com piso
   * (`WHERE quantity >= X`), pedido direto do usuário em 2026-08-19 ("não
   * posso ter 5 produtos cadastrados e no fim acabar tendo 6 vendidos") —
   * abortava a transação inteira com `InsufficientStockError` se o estoque
   * não desse. Uma tentativa de tornar isso um toggle via arquivo de config
   * (`ALLOW_NEGATIVE_STOCK`) não funcionou de forma confiável em campo —
   * removida. Agora usa `upsert` incondicional (cobre até produto sem
   * `StockItem` nenhum ainda, criando já negativo) — o saldo pode ir
   * negativo de propósito, e o sync reflete a mesma baixa pro Bling. Pra
   * reverter, é só trocar de volta pro `updateMany` com o piso e o throw de
   * `InsufficientStockError` (ver histórico do git).
   */
  async confirm(
    saleId: string,
    warehouseId: string,
    actorUserId: string | null,
    customerDocument: string | null,
    customerName: string | null,
  ): Promise<Sale> {
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

    const syncPayload: SaleSyncPayload = {
      saleId,
      totalAmount: sale.totalAmount,
      confirmedAt: confirmedAt.toISOString(),
      customerDocument,
      customerName,
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

      for (const item of sale.items) {
        await tx.stockItem.upsert({
          where: { warehouseId_productId: { warehouseId, productId: item.productId } },
          update: { quantity: { decrement: item.quantity } },
          create: { warehouseId, productId: item.productId, quantity: -item.quantity },
        });
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
   * Roda dentro da transação de quem chamou (PERF-03b) e soma via aggregate,
   * sem carregar as linhas.
   */
  private async recalculateTotal(tx: Prisma.TransactionClient, saleId: string): Promise<Sale> {
    const aggregate = await tx.saleItem.aggregate({ where: { saleId }, _sum: { totalAmount: true } });
    const sale = await tx.sale.findUniqueOrThrow({ where: { id: saleId }, select: { discountAmount: true } });
    const subtotal = aggregate._sum.totalAmount ?? 0;
    const totalAmount = Math.max(0, subtotal - sale.discountAmount);
    const record = await tx.sale.update({
      where: { id: saleId },
      data: { totalAmount },
      include: SALE_INCLUDE,
    });
    return toDomainSale(record);
  }
}
