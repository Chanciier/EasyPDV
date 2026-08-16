import { Inject, Injectable } from "@nestjs/common";
import { SaleHasIssuedFiscalDocumentError, SaleNotFoundError, SaleNotVoidableError } from "../../domain/errors.js";
import type { Sale } from "../../domain/entities/sale.entity.js";
import { SALE_REPOSITORY, type SaleRepositoryPort } from "../ports/sale-repository.port.js";
import { FISCAL_STATUS_READER, type FiscalStatusReaderPort } from "../ports/fiscal-status-reader.port.js";

/**
 * Estorno de venda confirmada (Sprint 14) — devolve estoque, sem reembolso
 * automático. Explicitamente fora de escopo: propagar o estorno pro Bling
 * (o pedido de venda remoto continua existindo) e cancelar uma NFC-e já
 * emitida na SEFAZ — por isso o guarda-corrimão abaixo bloqueia o estorno
 * quando já existe um documento fiscal emitido pra essa venda.
 */
@Injectable()
export class VoidConfirmedSaleUseCase {
  constructor(
    @Inject(SALE_REPOSITORY) private readonly saleRepository: SaleRepositoryPort,
    @Inject(FISCAL_STATUS_READER) private readonly fiscalStatusReader: FiscalStatusReaderPort,
  ) {}

  async execute(saleId: string, actorUserId: string | null, reason: string): Promise<Sale> {
    const sale = await this.saleRepository.findById(saleId);
    if (!sale) {
      throw new SaleNotFoundError(saleId);
    }
    if (!sale.canBeVoided) {
      throw new SaleNotVoidableError(saleId);
    }
    const hasIssuedFiscalDocument = await this.fiscalStatusReader.hasIssuedFiscalDocument(saleId);
    if (hasIssuedFiscalDocument) {
      throw new SaleHasIssuedFiscalDocumentError(saleId);
    }
    return this.saleRepository.voidConfirmed(saleId, actorUserId, reason);
  }
}
