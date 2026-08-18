import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { BlingProductSummary } from "@easypdv/shared-types";
import { PrismaService } from "../../../../prisma/prisma.service.js";
import type { BlingCatalogGatewayPort } from "../../application/ports/bling-catalog-gateway.port.js";

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
    this.baseUrl = configService.get<string>("INTERMEDIADOR_URL") ?? "http://127.0.0.1:4002";
  }

  async listProducts(): Promise<BlingProductSummary[]> {
    const identity = await this.prisma.storeIdentity.findFirst();
    if (!identity) {
      throw new Error("Terminal ainda não foi ativado — sem apiKey pra sincronizar com o Intermediador");
    }

    const response = await fetch(`${this.baseUrl}/integrations/bling/products`, {
      headers: { "X-Terminal-Api-Key": identity.apiKey },
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(body?.message ?? `Intermediador respondeu ${response.status} para GET /integrations/bling/products`);
    }
    return (await response.json()) as BlingProductSummary[];
  }
}
