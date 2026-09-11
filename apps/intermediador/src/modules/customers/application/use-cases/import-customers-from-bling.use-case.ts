import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  ERP_INTEGRATION_REPOSITORY,
  type ErpIntegrationRepositoryPort,
} from "../../../erp-integration/application/ports/erp-integration-repository.port.js";
import type { ErpProviderCode } from "../../../erp-integration/domain/entities/erp-integration.entity.js";
import { ErpIntegrationNotFoundError } from "../../../erp-integration/domain/errors.js";
import { BlingApiClient } from "../../../erp-integration/infrastructure/clients/bling-api.client.js";
import { BlingTokenProviderService } from "../../../erp-integration/infrastructure/clients/bling-token-provider.service.js";
import { CUSTOMER_REPOSITORY, type CustomerRepositoryPort } from "../ports/customer-repository.port.js";

const PROVIDER: ErpProviderCode = "bling";
const PAGE_SIZE = 100;
/** Mesmo teto de segurança de ListBlingProductsUseCase — rede contra paginação infinita, não o tamanho esperado do cadastro. */
const MAX_PAGES = 5000;
/** Mesmo espaçamento de ListBlingProductsUseCase — o Bling limita requisições/segundo. */
const PAGE_DELAY_MS = 400;
/** Espaçamento entre as chamadas de detalhe (uma por contato com documento, só pra pegar `celular` — não vem na listagem). Mesmo motivo do PAGE_DELAY_MS. */
const DETAIL_DELAY_MS = 350;

export interface ImportCustomersFromBlingResult {
  created: number;
  updated: number;
  skipped: number;
  total: number;
}

/**
 * Botão "Sincronizar com Bling" na tela Clientes (2026-09-11) — mesmo padrão
 * do botão homônimo em Produtos (`SyncProductsFromBlingUseCase`,
 * pdv-backend), mas a escrita acontece aqui mesmo: `Customer` já é central
 * no Intermediador (ver Cliente Centralizado no Intermediador.md), não
 * precisa ir e voltar pro terminal. Sem filtro de tipo — traz TODOS os
 * contatos da conta, não só o Clube (`listContactsByTipo` continua existindo
 * separado, pra isso).
 *
 * Bling sempre sobrescreve nome/telefone em conflito — mesma decisão já
 * confirmada com o usuário pro sync de Produtos ("produtos nascem no
 * Bling"; aqui, cliente nasce no Bling). `email` nunca é tocado: não é dado
 * confiável vindo do contato aqui, e não deve apagar um e-mail cadastrado
 * manualmente no PDV.
 */
@Injectable()
export class ImportCustomersFromBlingUseCase {
  private readonly logger = new Logger(ImportCustomersFromBlingUseCase.name);

  constructor(
    @Inject(ERP_INTEGRATION_REPOSITORY) private readonly erpIntegrationRepository: ErpIntegrationRepositoryPort,
    private readonly tokenProvider: BlingTokenProviderService,
    private readonly blingApiClient: BlingApiClient,
    @Inject(CUSTOMER_REPOSITORY) private readonly customerRepository: CustomerRepositoryPort,
  ) {}

  async execute(organizationId: string): Promise<ImportCustomersFromBlingResult> {
    const integration = await this.erpIntegrationRepository.findByOrganization(organizationId, PROVIDER);
    if (!integration) {
      throw new ErpIntegrationNotFoundError(organizationId);
    }
    const accessToken = await this.tokenProvider.getValidAccessToken(integration);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let total = 0;
    let hitPageCeiling = true;

    for (let pagina = 1; pagina <= MAX_PAGES; pagina++) {
      if (pagina > 1) {
        await sleep(PAGE_DELAY_MS);
      }
      const page = await this.blingApiClient.listContactsPage(accessToken, pagina, PAGE_SIZE);
      if (page.length === 0) {
        hitPageCeiling = false;
        break;
      }

      for (const contact of page) {
        total++;
        if (!contact.numeroDocumento) {
          skipped++;
          continue;
        }

        await sleep(DETAIL_DELAY_MS);
        const detail = await this.blingApiClient.getContactById(accessToken, contact.id);

        const existing = await this.customerRepository.findByDocument(organizationId, contact.numeroDocumento);
        if (existing) {
          await this.customerRepository.update(organizationId, existing.id, {
            name: detail.nome,
            phone: detail.celular ?? null,
          });
          updated++;
        } else {
          await this.customerRepository.create({
            organizationId,
            name: detail.nome,
            document: contact.numeroDocumento,
            phone: detail.celular ?? null,
            email: null,
          });
          created++;
        }
      }

      if (page.length < PAGE_SIZE) {
        hitPageCeiling = false;
        break;
      }
    }

    if (hitPageCeiling) {
      this.logger.warn(
        `Paginação de /contatos atingiu o teto de segurança (${MAX_PAGES} páginas) sem a última página vir vazia — cadastro pode ter sido cortado. Considere aumentar MAX_PAGES.`,
      );
    }

    return { created, updated, skipped, total };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
