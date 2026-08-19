import type { BlingProductSummary } from "@easypdv/shared-types";

export interface BlingCatalogGatewayPort {
  /**
   * `since`, quando informado, pede ao Intermediador só produtos alterados a
   * partir dessa data — usado pelo poll incremental periódico de estoque
   * (2026-08-19). Sem `since`, puxa o catálogo inteiro (botão manual e sync
   * na ativação de terminal).
   */
  listProducts(since?: Date): Promise<BlingProductSummary[]>;
}

export const BLING_CATALOG_GATEWAY = Symbol("BLING_CATALOG_GATEWAY");
