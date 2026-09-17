import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { getIntermediadorUrl } from "../../../../common/intermediador-config.js";
import type { BlingProductSummary } from "@easypdv/shared-types";
import { PrismaService } from "../../../../prisma/prisma.service.js";
import type { BlingCatalogGatewayPort } from "../../application/ports/bling-catalog-gateway.port.js";

/**
 * Catálogo completo do Bling pode chegar a dezenas de milhares de produtos
 * numa resposta só (ver SyncProductsFromBlingUseCase) — timeout bem mais
 * folgado que o default de gateway pontual.
 */
const CATALOG_SYNC_TIMEOUT_MS = 120_000;

/**
 * Lê a apiKey do terminal direto via PrismaService (global), sem importar
 * ProvisioningModule — evita fechar o ciclo Catalog → Provisioning → Sales →
 * Catalog (SalesModule já importa CatalogModule). Mesmo padrão da "porta
 * local pequena" da Sprint 14 (ver docs/CHANGELOG.md, VoidConfirmedSaleUseCase).
 */
@Injectable()
export class HttpBlingCatalogGateway implements BlingCatalogGatewayPort {
  private readonly baseUrl: string;

  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.baseUrl = getIntermediadorUrl(configService);
  }

  async listProducts(since?: Date): Promise<BlingProductSummary[]> {
    const identity = await this.prisma.storeIdentity.findFirst();
    if (!identity) {
      throw new Error("Terminal ainda não foi ativado — sem apiKey pra sincronizar com o Intermediador");
    }

    const url = new URL(`${this.baseUrl}/integrations/bling/products`);
    if (since) {
      url.searchParams.set("since", since.toISOString());
    }
    const response = await fetch(url, {
      headers: { "X-Terminal-Api-Key": identity.apiKey },
      signal: AbortSignal.timeout(CATALOG_SYNC_TIMEOUT_MS),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(body?.message ?? `Intermediador respondeu ${response.status} para GET /integrations/bling/products`);
    }
    return (await response.json()) as BlingProductSummary[];
  }
}
