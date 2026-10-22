import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service.js";
import { BlingSyncAlreadyRunningError } from "../../domain/errors.js";
import { BLING_CATALOG_GATEWAY, type BlingCatalogGatewayPort } from "../ports/bling-catalog-gateway.port.js";
import { PRICE_LIST_REPOSITORY, type PriceListRepositoryPort } from "../ports/price-list-repository.port.js";

export interface SyncProductsFromBlingResult {
  created: number;
  /** Produtos existentes que de fato mudaram (nome, ativo, preço ou estoque). */
  updated: number;
  /** Produtos existentes idênticos ao Bling — nada reescrito (PERF-06). */
  unchanged: number;
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
 *
 * **Só escreve o que mudou** (2026-10-22, PERF-06): o poll incremental
 * reprocessa uma janela de pelo menos 24 h a cada 5 min, e antes cada produto
 * visto custava ~5 statements e 2 escritas incondicionais mesmo idêntico ao
 * Bling. Agora cada lote pré-carrega produto/preço/estoque com 3 `findMany` e
 * só grava a diferença. "Bling sobrescreve catálogo" continua valendo — só
 * deixamos de reescrever valores iguais. `blingSyncedAt` continua marcado em
 * todo produto visto num sync COMPLETO (um `updateMany` por lote), senão a
 * varredura de desativação no fim desligaria o catálogo inteiro.
 */
const BATCH_SIZE = 50;

/**
 * Timeout da transação interativa de cada lote. O default do Prisma é 5s e
 * não bastava num PC de loja mais lento (HDD, antivírus escaneando o .db):
 * o lote estourava, a transação era abortada (P2028 "Transaction already
 * closed"), o sync parava no meio — catálogo parcial — e clicar de novo
 * falhava no mesmo ponto. Lote menor + timeout folgado resolvem.
 */
const BATCH_TRANSACTION_TIMEOUT_MS = 120_000;
const BATCH_TRANSACTION_MAX_WAIT_MS = 60_000;

@Injectable()
export class SyncProductsFromBlingUseCase {
  /** Trava em memória (PERF-06): botão manual e poll nunca escrevem ao mesmo tempo. Liberada no `finally`. */
  private running = false;

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
  /** O poll consulta antes para pular o ciclo em silêncio enquanto um sync manual roda. */
  get isRunning(): boolean {
    return this.running;
  }

  async execute(since?: Date): Promise<SyncProductsFromBlingResult> {
    if (this.running) {
      throw new BlingSyncAlreadyRunningError();
    }
    this.running = true;
    try {
      return await this.run(since);
    } finally {
      this.running = false;
    }
  }

  private async run(since?: Date): Promise<SyncProductsFromBlingResult> {
    const isFullSync = !since;
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
    let unchanged = 0;

    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);
      const batchResult = await this.prisma.$transaction(async (tx) => {
        let batchCreated = 0;
        let batchUpdated = 0;
        let batchUnchanged = 0;
        // Existentes sem nenhuma mudança que ainda precisam do carimbo
        // `blingSyncedAt` (todos num sync completo; só os nunca carimbados
        // num incremental).
        const stampIds: string[] = [];

        const existingProducts = await tx.product.findMany({
          where: { sku: { in: batch.map((item) => item.code) } },
          select: { id: true, sku: true, name: true, active: true, blingSyncedAt: true },
        });
        const productBySku = new Map(existingProducts.map((product) => [product.sku, product]));
        const existingIds = existingProducts.map((product) => product.id);
        const [priceItems, stockItems] = await Promise.all([
          tx.priceListItem.findMany({
            where: { priceListId, productId: { in: existingIds } },
            select: { productId: true, price: true },
          }),
          warehouse
            ? tx.stockItem.findMany({
                where: { warehouseId: warehouse.id, productId: { in: existingIds } },
                select: { productId: true, quantity: true },
              })
            : Promise.resolve([]),
        ]);
        const priceByProduct = new Map(priceItems.map((row) => [row.productId, row.price]));
        const stockByProduct = new Map(stockItems.map((row) => [row.productId, row.quantity]));

        for (const item of batch) {
          const existing = productBySku.get(item.code);
          let productId: string;
          let changed = false;

          if (existing) {
            productId = existing.id;
            if (existing.name !== item.name || !existing.active) {
              await tx.product.update({
                where: { id: existing.id },
                data: { name: item.name, active: true, blingSyncedAt: syncStartedAt },
              });
              existing.name = item.name;
              existing.active = true;
              existing.blingSyncedAt = syncStartedAt;
              changed = true;
            }
          } else {
            const product = await tx.product.create({
              data: { sku: item.code, name: item.name, categoryId: null, unit: "un", blingSyncedAt: syncStartedAt },
            });
            productId = product.id;
            // SKU repetido no mesmo lote cai no ramo "existente" na próxima vez.
            productBySku.set(item.code, {
              id: product.id,
              sku: product.sku,
              name: product.name,
              active: product.active,
              blingSyncedAt: syncStartedAt,
            });
            batchCreated++;
          }

          if (item.price !== null && priceByProduct.get(productId) !== item.price) {
            await tx.priceListItem.upsert({
              where: { priceListId_productId: { priceListId, productId } },
              create: { priceListId, productId, price: item.price },
              update: { price: item.price },
            });
            priceByProduct.set(productId, item.price);
            changed = true;
          }

          // Bling é a fonte da verdade do estoque nesta direção (mesma decisão
          // já valendo pra nome/preço) — sobrescreve o saldo local. O ledger
          // (StockMovement) recebe um lançamento de ajuste com a DIFERENÇA,
          // pra não quebrar a invariante "StockItem é projeção do ledger"
          // (ver docs/DATABASE.md).
          if (warehouse && item.stock !== null) {
            const delta = item.stock - (stockByProduct.get(productId) ?? 0);
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
              stockByProduct.set(productId, item.stock);
              changed = true;
            }
          }

          if (existing) {
            if (changed) {
              batchUpdated++;
            } else {
              batchUnchanged++;
            }
            // Carimbo sem reescrever o produto: num sync completo todo
            // existente visto (senão a desativação no fim o pegaria); num
            // incremental só quem nunca foi carimbado.
            const alreadyStamped = existing.blingSyncedAt !== null && existing.blingSyncedAt >= syncStartedAt;
            if (!alreadyStamped && (isFullSync || existing.blingSyncedAt === null)) {
              stampIds.push(existing.id);
              existing.blingSyncedAt = syncStartedAt;
            }
          }
        }

        if (stampIds.length > 0) {
          await tx.product.updateMany({ where: { id: { in: stampIds } }, data: { blingSyncedAt: syncStartedAt } });
        }

        return { created: batchCreated, updated: batchUpdated, unchanged: batchUnchanged };
      }, { timeout: BATCH_TRANSACTION_TIMEOUT_MS, maxWait: BATCH_TRANSACTION_MAX_WAIT_MS });

      created += batchResult.created;
      updated += batchResult.updated;
      unchanged += batchResult.unchanged;
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
    if (isFullSync) {
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

    return { created, updated, unchanged, deactivated, total: products.length };
  }
}
