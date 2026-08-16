import { Inject, Injectable } from "@nestjs/common";
import type { FiscalStatusPayload } from "@easypdv/shared-types";
import {
  FISCAL_DOCUMENT_REPOSITORY,
  type FiscalDocumentRepositoryPort,
} from "../ports/fiscal-document-repository.port.js";
import { FiscalDocumentNotFoundError } from "../../domain/errors.js";

/** Consultado pelo PDV local (GET /fiscal/sale/:saleId) pra espelhar o status fiscal no seu próprio FiscalDocument (SQLite). */
@Injectable()
export class GetFiscalStatusUseCase {
  constructor(
    @Inject(FISCAL_DOCUMENT_REPOSITORY) private readonly fiscalDocumentRepository: FiscalDocumentRepositoryPort,
  ) {}

  async execute(saleId: string): Promise<FiscalStatusPayload> {
    const doc = await this.fiscalDocumentRepository.findBySale(saleId);
    if (!doc) {
      throw new FiscalDocumentNotFoundError(saleId);
    }
    return {
      type: doc.type,
      status: doc.status,
      documentNumber: doc.documentNumber,
      accessKey: doc.accessKey,
      danfeUrl: doc.danfeUrl,
      qrCodeUrl: doc.qrCodeUrl,
      errorMessage: doc.errorMessage,
      issuedAt: doc.issuedAt ? doc.issuedAt.toISOString() : null,
    };
  }
}
