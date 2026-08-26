import { Inject, Injectable } from "@nestjs/common";
import type { FiscalDocument } from "../../domain/entities/fiscal-document.entity.js";
import {
  FISCAL_DOCUMENT_REPOSITORY,
  type FiscalDocumentRepositoryPort,
} from "../ports/fiscal-document-repository.port.js";
import { FISCAL_GATEWAY, type FiscalGatewayPort } from "../ports/fiscal-gateway.port.js";

/**
 * Ação explícita do operador (botão "Emitir cupom fiscal" no Histórico, só
 * aparece pra vendas sem CPF) — ao contrário de GetFiscalStatusUseCase, não
 * cai pro cache local em caso de falha: o operador precisa saber que a
 * emissão não aconteceu, não ver um resultado antigo como se tivesse dado certo.
 */
@Injectable()
export class IssueFiscalReceiptManuallyUseCase {
  constructor(
    @Inject(FISCAL_DOCUMENT_REPOSITORY) private readonly fiscalDocumentRepository: FiscalDocumentRepositoryPort,
    @Inject(FISCAL_GATEWAY) private readonly fiscalGateway: FiscalGatewayPort,
  ) {}

  async execute(saleId: string): Promise<FiscalDocument | null> {
    const remote = await this.fiscalGateway.issueManually(saleId);
    if (!remote) {
      return null;
    }
    return this.fiscalDocumentRepository.upsertFromRemote({
      saleId,
      ...remote,
      issuedAt: remote.issuedAt ? new Date(remote.issuedAt) : null,
    });
  }
}
