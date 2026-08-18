import type { BlingProductSummary } from "@easypdv/shared-types";

export interface BlingCatalogGatewayPort {
  listProducts(): Promise<BlingProductSummary[]>;
}

export const BLING_CATALOG_GATEWAY = Symbol("BLING_CATALOG_GATEWAY");
