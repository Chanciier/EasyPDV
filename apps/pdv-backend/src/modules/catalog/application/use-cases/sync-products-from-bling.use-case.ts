import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service.js";
import { BLING_CATALOG_GATEWAY, type BlingCatalogGatewayPort } from "../ports/bling-catalog-gateway.port.js";
import { PRICE_LIST_REPOSITORY, type PriceListRepositoryPort } from "../ports/price-list-repository.port.js";

export interface SyncProductsFromBlingResult {
  created: number;
  updated: number;
  deactivated: number;
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
 * **Desativa produtos que sumiram do Bling** (2026-08-19, pedido do usuário
 * depois de notar que um produto apagado no Bling continuava aparecendo no
 * PDV) — só num sync COMPLETO (`since` indefinido: incremental só traz o que
 * mudou, não prova que algo foi removido) e só pra produtos com
 * `blingSyncedAt` preenchido (já vistos pelo Bling alguma vez — nunca um
 * produto cadastrado só localmente). Desativa, nunca apaga: `Product` pode
 * ter `SaleItem` histórico ligado.
 *
 * Loop de escrita bate direto no PrismaService (não em ProductRepositoryPort)
 * de propósito — bug real de performance achado testando com o catálogo Bling
 * de verdade (~11 mil produtos): cada `create`/`update`/`upsertItem` fora de
 * uma transação explícita é seu próprio commit SQLite (fsync individual),
 * levando o sync a passar de 8 minutos.
 *
 * **Escrita em lotes de `BATCH_SIZE`, não numa `$transaction` única pro
 * catálogo inteiro** — achado real (2026-08-19, catálogo de ~27 mil
 * produtos): uma única transação levou ~9-10 minutos, e o SQLite (fora do
 * modo WAL até então — ver `PrismaService`) mantém lock exclusivo do arquivo
 * INTEIRO enquanto uma transação de escrita está aberta. Resultado: o app
 * inteiro ficou fora do ar durante o sync — busca de produto, venda,
 * `GET /provisioning/status`, tudo devolvendo erro. Lotes pequenos limitam
 * quanto tempo qualquer commit segura o lock, deixando outras escritas
 * (ex: confirmar uma venda) intercalarem entre lotes em vez de esperar o
 * sync inteiro. Efeito colateral aceitável: um crash no meio do sync deixa
 * o catálogo parcialmente atualizado — inofensivo, é um espelho idempotente
 * do Bling, o próximo sync (manual ou o poll incremental) completa o resto.
 */
const BATCH_SIZE = 200;

@Injectable()
export class SyncProductsFromBlingUseCase {
  constructor(
    @Inject(BLING_CATALOG_GATEWAY) private readonly blingCatalogGateway: BlingCatalogGatewayPort,
    @Inject(PRICE_LIST_REPOSITORY) private readonly priceListRepository: PriceListRepositoryPort,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * `since`, quando informado, faz um sync INCREMENTAL — só produtos
   * alterados no Bling a partir dessa data (usado pelo poll periódico,
   * `BlingStockSyncWorker`, 2026-08-19). Sem `since`, sync completo (botão
   * manual e ativação de terminal). Em qualquer um dos dois casos, ao
   * terminar com sucesso grava `StoreIdentity.lastBlingSyncAt = agora` — é
   * o `since` que o PRÓXIMO poll incremental vai usar. Centralizado aqui
   * (em vez de no worker) pra ter uma fonte só de verdade: qualquer chamador
   * que sincronizar com sucesso empurra o marcador pra frente.
   */
  async execute(since?: Date): Promise<SyncProductsFromBlingResult> {
    // Capturado ANTES de qualquer escrita — é o corte usado depois pra achar
    // produtos que ficaram de fora deste sync (ver `blingSyncedAt` abaixo).
    const syncStartedAt = new Date();
    const products = await this.blingCatalogGateway.listProducts(since);

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

    let created = 0;
    let updated = 0;

    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);
      const batchResult = await this.prisma.$transaction(async (tx) => {
        let batchCreated = 0;
        let batchUpdated = 0;

        for (const item of batch) {
          const existing = await tx.product.findUnique({ where: { sku: item.code } });
          let productId: string;

          if (existing) {
            await tx.product.update({
              where: { id: existing.id },
              data: { name: item.name, active: true, blingSyncedAt: syncStartedAt },
            });
            productId = existing.id;
            batchUpdated++;
          } else {
            const product = await tx.product.create({
              data: { sku: item.code, name: item.name, categoryId: null, unit: "un", blingSyncedAt: syncStartedAt },
            });
            productId = product.id;
            batchCreated++;
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

        return { created: batchCreated, updated: batchUpdated };
      });

      created += batchResult.created;
      updated += batchResult.updated;
    }

    /**
     * Desativa localmente o que sumiu do Bling — só num sync COMPLETO
     * (`since` indefinido): um sync incremental só traz o que MUDOU, não a
     * lista inteira, então a ausência de um SKU não prova nada (pode só não
     * ter mudado). Só entra nessa varredura produto com `blingSyncedAt`
     * preenchido (já visto pelo Bling alguma vez) — nunca um produto
     * cadastrado só localmente (`+ Novo produto`, `blingSyncedAt` null),
     * que não tem relação nenhuma com o Bling pra começo de conversa. Bling
     * é a fonte da verdade nesta direção (mesma decisão de nome/preço/
     * estoque) — desativa, nunca apaga (produto pode ter `SaleItem`
     * histórico ligado).
     */
    let deactivated = 0;
    if (!since) {
      const result = await this.prisma.product.updateMany({
        where: { active: true, blingSyncedAt: { not: null, lt: syncStartedAt } },
        data: { active: false },
      });
      deactivated = result.count;
    }

    // Fora da transação de propósito: já commitou os produtos, e mesmo que
    // essa escrita falhe (terminal desativado entre o início e o fim do
    // sync, por exemplo) não deve desfazer o sync que já aconteceu — só o
    // próximo poll incremental volta a puxar um pouco mais de trás.
    await this.prisma.storeIdentity.updateMany({ data: { lastBlingSyncAt: new Date() } });

    return { created, updated, deactivated, total: products.length };
  }
}
