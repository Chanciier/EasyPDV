import { Inject, Injectable, Logger } from "@nestjs/common";
import type { BlingProductSummary } from "@easypdv/shared-types";
import {
  ERP_INTEGRATION_REPOSITORY,
  type ErpIntegrationRepositoryPort,
} from "../ports/erp-integration-repository.port.js";
import type { ErpProviderCode } from "../../domain/entities/erp-integration.entity.js";
import { ErpIntegrationNotFoundError } from "../../domain/errors.js";
import { BlingApiClient } from "../../infrastructure/clients/bling-api.client.js";
import { BlingTokenProviderService } from "../../infrastructure/clients/bling-token-provider.service.js";

const PROVIDER: ErpProviderCode = "bling";
const PAGE_SIZE = 100;
/**
 * Teto de segurança contra paginação infinita se o Bling nunca devolver uma
 * página vazia — NÃO é o tamanho esperado do catálogo. Achado na prática
 * (testando com o Bling real do usuário): um teto de 200 páginas (20.000
 * produtos) cortou o catálogo pela metade, silenciosamente, sem nenhum erro —
 * só um número "redondo" suspeito no resultado. 5000 páginas (meio milhão de
 * produtos) é folga suficiente pra qualquer catálogo real continuar sendo
 * limitado só pelas condições de parada de verdade (página vazia ou menor
 * que PAGE_SIZE), com esse teto só como rede de segurança de última instância.
 */
const MAX_PAGES = 5000;
/** Espaçamento entre páginas — o Bling limita requisições/segundo (achado na prática: 429 por volta da 6ª página disparada em sequência). BlingApiClient.request também retenta 429 individualmente; isso aqui é só pra reduzir quantos retries acontecem. */
const PAGE_DELAY_MS = 400;

/**
 * Consultado pelo PDV local (GET /integrations/bling/products) pra importar
 * o catálogo do Bling — direção nova, oposta ao sync existente (que só vai
 * PDV→Bling na venda). Pagina até a página vir vazia. `situacao === "A"`
 * filtra só produtos ativos no Bling (inativos não devem aparecer pra venda).
 */
@Injectable()
export class ListBlingProductsUseCase {
  private readonly logger = new Logger(ListBlingProductsUseCase.name);

  constructor(
    @Inject(ERP_INTEGRATION_REPOSITORY) private readonly erpIntegrationRepository: ErpIntegrationRepositoryPort,
    private readonly tokenProvider: BlingTokenProviderService,
    private readonly blingApiClient: BlingApiClient,
  ) {}

  async execute(organizationId: string): Promise<BlingProductSummary[]> {
    const integration = await this.erpIntegrationRepository.findByOrganization(organizationId, PROVIDER);
    if (!integration) {
      throw new ErpIntegrationNotFoundError(organizationId);
    }
    const accessToken = await this.tokenProvider.getValidAccessToken(integration);

    const products: BlingProductSummary[] = [];
    let hitPageCeiling = true;
    for (let pagina = 1; pagina <= MAX_PAGES; pagina++) {
      if (pagina > 1) {
        await sleep(PAGE_DELAY_MS);
      }
      const page = await this.blingApiClient.listProductsPage(accessToken, pagina, PAGE_SIZE);
      if (page.length === 0) {
        hitPageCeiling = false;
        break;
      }
      for (const item of page) {
        if (item.situacao && item.situacao !== "A") {
          continue;
        }
        products.push({
          code: item.codigo,
          name: item.nome,
          price: item.preco ?? null,
          stock: item.estoque?.saldoVirtualTotal ?? null,
        });
      }
      if (page.length < PAGE_SIZE) {
        hitPageCeiling = false;
        break;
      }
    }
    if (hitPageCeiling) {
      this.logger.warn(
        `Paginação de /produtos atingiu o teto de segurança (${MAX_PAGES} páginas) sem a última página vir vazia — catálogo pode ter sido cortado. Considere aumentar MAX_PAGES.`,
      );
    }
    return products;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
