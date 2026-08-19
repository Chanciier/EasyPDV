import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { PrismaService } from "../../../../prisma/prisma.service.js";
import { SyncProductsFromBlingUseCase } from "../../application/use-cases/sync-products-from-bling.use-case.js";

/**
 * Espaçamento entre polls incrementais — pedido do usuário (2026-08-19): "o
 * bling tem que andar junto com o estoque do intermediador [...] caso seja
 * zerado por algum motivo pelo bling, isso tem que ser atualizado no pdv".
 * Como o Bling não expõe webhook de mudança de estoque (confirmado contra a
 * lib pública `bling-erp-api-js` — só `depositos`/`estoques` como endpoints
 * de consulta/escrita, nenhuma entidade de notificação de eventos), a única
 * forma de saber que o Bling mudou é perguntar periodicamente. 5 minutos
 * balanceia frescor com o rate limit do Bling (`SyncProductsFromBlingUseCase`
 * já filtra `dataAlteracaoInicial`, então cada poll só traz o que mudou desde
 * o último — barato mesmo num catálogo de dezenas de milhares de SKUs).
 */
const POLL_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Metade Bling→PDV do sync bidirecional de estoque (a metade PDV→Bling é
 * `pushStockMovements` no BlingSyncTargetAdapter, Intermediador). Só roda se
 * `StoreIdentity.lastBlingSyncAt` já estiver setado — ou seja, só depois que
 * ALGUM sync completo já rodou com sucesso (botão manual "Sincronizar com
 * Bling" ou o sync automático da ativação de terminal). Sem essa guarda, um
 * terminal sem Bling conectado (ou cujo sync inicial falhou) tentaria um sync
 * de catálogo INTEIRO a cada 5 minutos pra sempre — pesado e sempre falhando
 * do mesmo jeito. Uma vez que o marcador existe, todo poll seguinte é
 * incremental (barato) independente de quem gravou o marcador primeiro.
 */
@Injectable()
export class BlingStockSyncWorker {
  private readonly logger = new Logger(BlingStockSyncWorker.name);

  constructor(
    private readonly syncProductsFromBlingUseCase: SyncProductsFromBlingUseCase,
    private readonly prisma: PrismaService,
  ) {}

  @Interval(POLL_INTERVAL_MS)
  async poll(): Promise<void> {
    const identity = await this.prisma.storeIdentity.findFirst();
    if (!identity?.lastBlingSyncAt) {
      return;
    }

    try {
      const result = await this.syncProductsFromBlingUseCase.execute(identity.lastBlingSyncAt);
      if (result.created > 0 || result.updated > 0) {
        this.logger.log(
          `Poll incremental Bling: ${result.created} produto(s) novo(s), ${result.updated} atualizado(s) (estoque/preço/nome)`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Falha no poll incremental de estoque com o Bling: ${message}`);
    }
  }
}
