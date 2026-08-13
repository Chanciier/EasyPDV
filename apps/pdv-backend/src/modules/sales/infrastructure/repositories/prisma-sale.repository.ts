import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service.js";
import { Sale } from "../../domain/entities/sale.entity.js";
import type {
  AddSaleItemData,
  SaleRepositoryPort,
  StartSaleData,
} from "../../application/ports/sale-repository.port.js";
import { toDomainSale } from "../mappers/sales.mapper.js";

const SALE_INCLUDE = { items: true } as const;

@Injectable()
export class PrismaSaleRepository implements SaleRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Sale | null> {
    const record = await this.prisma.sale.findUnique({ where: { id }, include: SALE_INCLUDE });
    return record ? toDomainSale(record) : null;
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

  async cancel(id: string): Promise<Sale> {
    const record = await this.prisma.sale.update({
      where: { id },
      data: { status: "cancelled" },
      include: SALE_INCLUDE,
    });
    return toDomainSale(record);
  }

  private async recalculateTotal(saleId: string): Promise<Sale> {
    const items = await this.prisma.saleItem.findMany({ where: { saleId } });
    const totalAmount = items.reduce((sum, item) => sum + item.totalAmount, 0);
    const record = await this.prisma.sale.update({
      where: { id: saleId },
      data: { totalAmount },
      include: SALE_INCLUDE,
    });
    return toDomainSale(record);
  }
}
