import { Inject, Injectable, Logger } from "@nestjs/common";
import type { FiscalDocument } from "../../domain/entities/fiscal-document.entity.js";
import {
  FISCAL_DOCUMENT_REPOSITORY,
  type FiscalDocumentRepositoryPort,
} from "../ports/fiscal-document-repository.port.js";
import { FISCAL_GATEWAY, type FiscalGatewayPort } from "../ports/fiscal-gateway.port.js";

/**
 * Chamado sob demanda pela tela de Histórico (não é um sync automático em
 * background) — sempre tenta buscar o status mais recente no Intermediador
 * primeiro; se a rede falhar (terminal offline, Intermediador fora do ar),
 * cai pro que já está espelhado localmente em vez de falhar a tela inteira.
 * `null` (sem cache e sem resposta) é um resultado normal — nem toda venda
 * tem documento fiscal (emissão de NFC-e é opt-in, ver Sprint 12).
 */
@Injectable()
export class GetFiscalStatusUseCase {
  private readonly logger = new Logger(GetFiscalStatusUseCase.name);

  constructor(
    @Inject(FISCAL_DOCUMENT_REPOSITORY) private readonly fiscalDocumentRepository: FiscalDocumentRepositoryPort,
    @Inject(FISCAL_GATEWAY) private readonly fiscalGateway: FiscalGatewayPort,
  ) {}

  async execute(saleId: string): Promise<FiscalDocument | null> {
    try {
      const remote = await this.fiscalGateway.fetchStatus(saleId);
      if (!remote) {
        return null;
      }
      return await this.fiscalDocumentRepository.upsertFromRemote({
        saleId,
        ...remote,
        issuedAt: remote.issuedAt ? new Date(remote.issuedAt) : null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Não foi possível consultar status fiscal no Intermediador pra venda ${saleId}: ${message}`);
      return this.fiscalDocumentRepository.findBySale(saleId);
    }
  }
}
