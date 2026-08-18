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
        }

        return { created, updated };
      },
      { timeout: 10 * 60 * 1000, maxWait: 10 * 60 * 1000 },
    );

    return { created, updated, total: products.length };
  }
}
