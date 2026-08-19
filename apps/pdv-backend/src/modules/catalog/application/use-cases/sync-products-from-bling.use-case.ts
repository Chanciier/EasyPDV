import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service.js";
import { BLING_CATALOG_GATEWAY, type BlingCatalogGatewayPort } from "../ports/bling-catalog-gateway.port.js";
import { PRICE_LIST_REPOSITORY, type PriceListRepositoryPort } from "../ports/price-list-repository.port.js";

export interface SyncProductsFromBlingResult {
  created: number;
  updated: number;
  total: number;
}

/**
 * Botão manual "Sincronizar com Bling" na tela Produtos — importa/atualiza o
 * catálogo local a partir do Bling (direção nova, oposta ao sync existente
 * PDV→Bling na venda). Casamento por `sku` ↔ `codigo` do Bling (mesma
 * convenção que `BlingSyncTargetAdapter.resolveProduct` já usa no
 * Intermediador). Bling sempre sobrescreve nome/preço em conflito — decisão
 * confirmada com o usuário (produtos nascem no Bling, cadastrados no galpão).
 * `unit`/`categoryId` não vêm do Bling — preservados como estavam num
 * produto já existente, default "un"/null num produto novo.
 *
 * Loop de escrita bate direto no PrismaService (não em ProductRepositoryPort)
 * de propósito — bug real de performance achado testando com o catálogo Bling
 * de verdade (~11 mil produtos): cada `create`/`update`/`upsertItem` fora de
 * uma transação explícita é seu próprio commit SQLite (fsync individual),
 * levando o sync a passar de 8 minutos. Envolvendo TODO o loop num único
 * `$transaction` interativo, o SQLite faz um fsync só no final — mesmo
 * catálogo, poucos segundos.
 */
@Injectable()
export class SyncProductsFromBlingUseCase {
  constructor(
    @Inject(BLING_CATALOG_GATEWAY) private readonly blingCatalogGateway: BlingCatalogGatewayPort,
    @Inject(PRICE_LIST_REPOSITORY) private readonly priceListRepository: PriceListRepositoryPort,
    private readonly prisma: PrismaService,
  ) {}

  async execute(): Promise<SyncProductsFromBlingResult> {
    const products = await this.blingCatalogGateway.listProducts();

    let priceList = await this.priceListRepository.findActive();
    if (!priceList) {
      priceList = await this.priceListRepository.create("Padrão");
    }
    const priceListId = priceList.id;

    /**
     * Estoque também vem do Bling desde 2026-08-18 — antes o sync trazia só
     * SKU/nome/preço e todo produto importado nascia com saldo ZERO local,
     * então a primeira venda real já deixava o saldo negativo (-1) enquanto o
     * Bling mostrava 1. `ensureDefaultWarehouse` (main.ts) garante que este
     * depósito existe em todo boot; se por algum motivo não existir, o sync
     * de catálogo segue normalmente e só o estoque fica de fora.
     */
    const warehouse = await this.prisma.warehouse.findFirst({ orderBy: { createdAt: "asc" } });

    const { created, updated } = await this.prisma.$transaction(
      async (tx) => {
        let created = 0;
        let updated = 0;

        for (const item of products) {
          const existing = await tx.product.findUnique({ where: { sku: item.code } });
          let productId: string;

          if (existing) {
            await tx.product.update({ where: { id: existing.id }, data: { name: item.name, active: true } });
            productId = existing.id;
            updated++;
          } else {
            const product = await tx.product.create({
              data: { sku: item.code, name: item.name, categoryId: null, unit: "un" },
            });
            productId = product.id;
            created++;
          }

          if (item.price !== null) {
            await tx.priceListItem.upsert({
              where: { priceListId_productId: { priceListId, productId } },
              create: { priceListId, productId, price: item.price },
              update: { price: item.price },
            });
          }

          // Bling é a fonte da verdade do estoque nesta direção (mesma decisão
          // já valendo pra nome/preço) — sobrescreve o saldo local. O ledger
          // (StockMovement) recebe um lançamento de ajuste com a DIFERENÇA,
          // pra não quebrar a invariante "StockItem é projeção do ledger"
          // (ver docs/DATABASE.md).
          if (warehouse && item.stock !== null) {
            const current = await tx.stockItem.findUnique({
              where: { warehouseId_productId: { warehouseId: warehouse.id, productId } },
            });
            const delta = item.stock - (current?.quantity ?? 0);
            if (delta !== 0) {
              await tx.stockMovement.create({
                data: {
                  warehouseId: warehouse.id,
                  productId,
                  type: "ajuste",
                  quantity: delta,
                  referenceType: "bling_sync",
                },
              });
              await tx.stockItem.upsert({
                where: { warehouseId_productId: { warehouseId: warehouse.id, productId } },
                create: { warehouseId: warehouse.id, productId, quantity: item.stock },
                update: { quantity: item.stock },
              });
            }
          }
        }

        return { created, updated };
      },
      { timeout: 10 * 60 * 1000, maxWait: 10 * 60 * 1000 },
    );

    return { created, updated, total: products.length };
  }
}
