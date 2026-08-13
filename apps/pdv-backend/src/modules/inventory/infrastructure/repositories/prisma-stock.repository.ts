import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service.js";
import { StockItem } from "../../domain/entities/stock-item.entity.js";
import type { StockMovement } from "../../domain/entities/stock-movement.entity.js";
import type {
  ListMovementsFilter,
  RegisterMovementData,
  StockRepositoryPort,
} from "../../application/ports/stock-repository.port.js";
import { toDomainStockItem, toDomainStockMovement } from "../mappers/inventory.mapper.js";

@Injectable()
export class PrismaStockRepository implements StockRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async getStockItem(warehouseId: string, productId: string): Promise<StockItem | null> {
    const record = await this.prisma.stockItem.findUnique({
      where: { warehouseId_productId: { warehouseId, productId } },
    });
    return record ? toDomainStockItem(record) : null;
  }

  /**
   * Grava o movimento (ledger) e atualiza o saldo (projeção) na mesma
   * transação — nunca separado, senão os dois podem divergir. Ver docs/DATABASE.md.
   */
  async registerMovement(data: RegisterMovementData): Promise<StockMovement> {
    const [movementRecord] = await this.prisma.$transaction([
      this.prisma.stockMovement.create({
        data: {
          warehouseId: data.warehouseId,
          productId: data.productId,
          type: data.type,
          quantity: data.quantity,
          referenceType: data.referenceType ?? null,
          referenceId: data.referenceId ?? null,
          createdByUserId: data.createdByUserId ?? null,
        },
      }),
      this.prisma.stockItem.upsert({
        where: { warehouseId_productId: { warehouseId: data.warehouseId, productId: data.productId } },
        create: {
          warehouseId: data.warehouseId,
          productId: data.productId,
          quantity: data.quantity,
        },
        update: {
          quantity: { increment: data.quantity },
        },
      }),
    ]);
    return toDomainStockMovement(movementRecord);
  }

  async listMovements(filter: ListMovementsFilter): Promise<StockMovement[]> {
    const records = await this.prisma.stockMovement.findMany({
      where: { warehouseId: filter.warehouseId, productId: filter.productId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return records.map(toDomainStockMovement);
  }
}
