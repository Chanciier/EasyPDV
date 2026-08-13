import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service.js";
import { Product } from "../../domain/entities/product.entity.js";
import type {
  CreateProductData,
  ProductRepositoryPort,
  UpdateProductData,
} from "../../application/ports/product-repository.port.js";
import { toDomainProduct } from "../mappers/catalog.mapper.js";

@Injectable()
export class PrismaProductRepository implements ProductRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Product | null> {
    const record = await this.prisma.product.findUnique({ where: { id } });
    return record ? toDomainProduct(record) : null;
  }

  async findBySku(sku: string): Promise<Product | null> {
    const record = await this.prisma.product.findUnique({ where: { sku } });
    return record ? toDomainProduct(record) : null;
  }

  async findByBarcode(code: string): Promise<Product | null> {
    const barcode = await this.prisma.barcode.findUnique({ where: { code }, include: { product: true } });
    return barcode ? toDomainProduct(barcode.product) : null;
  }

  async search(query: string): Promise<Product[]> {
    const records = await this.prisma.product.findMany({
      where: {
        active: true,
        OR: [
          { name: { contains: query } },
          { sku: { contains: query } },
        ],
      },
      take: 25,
    });
    return records.map(toDomainProduct);
  }

  async create(data: CreateProductData): Promise<Product> {
    const record = await this.prisma.product.create({ data });
    return toDomainProduct(record);
  }

  async update(id: string, data: UpdateProductData): Promise<Product> {
    const record = await this.prisma.product.update({ where: { id }, data });
    return toDomainProduct(record);
  }

  async addBarcode(productId: string, code: string, type: string): Promise<void> {
    await this.prisma.barcode.create({ data: { productId, code, type } });
  }

  async findBarcodeByCode(code: string): Promise<{ productId: string } | null> {
    const record = await this.prisma.barcode.findUnique({ where: { code } });
    return record ? { productId: record.productId } : null;
  }
}
