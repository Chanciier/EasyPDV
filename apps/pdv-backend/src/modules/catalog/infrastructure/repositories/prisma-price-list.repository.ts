import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service.js";
import { PriceListItem } from "../../domain/entities/price-list-item.entity.js";
import type {
  PriceListRecord,
  PriceListRepositoryPort,
  UpsertPriceListItemData,
} from "../../application/ports/price-list-repository.port.js";
import { toDomainPriceListItem } from "../mappers/catalog.mapper.js";

@Injectable()
export class PrismaPriceListRepository implements PriceListRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  findActive(): Promise<PriceListRecord | null> {
    return this.prisma.priceList.findFirst({ where: { active: true } });
  }

  findById(id: string): Promise<PriceListRecord | null> {
    return this.prisma.priceList.findUnique({ where: { id } });
  }

  create(name: string): Promise<PriceListRecord> {
    return this.prisma.priceList.create({ data: { name } });
  }

  async upsertItem(data: UpsertPriceListItemData): Promise<PriceListItem> {
    const record = await this.prisma.priceListItem.upsert({
      where: { priceListId_productId: { priceListId: data.priceListId, productId: data.productId } },
      create: data,
      update: { price: data.price, promotionalPrice: data.promotionalPrice },
    });
    return toDomainPriceListItem(record);
  }

  async findItem(priceListId: string, productId: string): Promise<PriceListItem | null> {
    const record = await this.prisma.priceListItem.findUnique({
      where: { priceListId_productId: { priceListId, productId } },
    });
    return record ? toDomainPriceListItem(record) : null;
  }
}
