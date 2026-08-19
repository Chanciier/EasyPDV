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

  /**
   * Cai pro `sku` quando não acha na tabela `Barcode` dedicada — achado real
   * (2026-08-19): produto sincronizado do Bling só ganha `sku` (= `codigo` do
   * Bling), nunca uma linha em `Barcode` (`SyncProductsFromBlingUseCase`
   * nunca cria uma). Pra muitos lojistas o "Código" cadastrado no Bling JÁ É
   * o código de barras físico do produto (como neste caso: "7897725022409")
   * — sem esse fallback, o leitor de código de barras nunca encontra NENHUM
   * produto vindo do Bling, só os cadastrados manualmente com um barcode
   * explícito pela tela Produtos.
   */
  async findByBarcode(code: string): Promise<Product | null> {
    const barcode = await this.prisma.barcode.findUnique({ where: { code }, include: { product: true } });
    if (barcode) {
      return toDomainProduct(barcode.product);
    }
    const bySku = await this.prisma.product.findUnique({ where: { sku: code } });
    return bySku ? toDomainProduct(bySku) : null;
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
