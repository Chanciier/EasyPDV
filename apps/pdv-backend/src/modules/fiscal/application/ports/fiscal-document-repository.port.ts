import type {
  FiscalDocument,
  FiscalDocumentStatusCode,
  FiscalDocumentTypeCode,
} from "../../domain/entities/fiscal-document.entity.js";

export interface UpsertFiscalDocumentData {
  saleId: string;
  type: FiscalDocumentTypeCode;
  status: FiscalDocumentStatusCode;
  documentNumber: string | null;
  accessKey: string | null;
  danfeUrl: string | null;
  errorMessage: string | null;
  issuedAt: Date | null;
}

export interface FiscalDocumentRepositoryPort {
  findBySale(saleId: string): Promise<FiscalDocument | null>;
  /** Espelha o resultado vindo do Intermediador (GET /fiscal/sale/:saleId) — cria ou atualiza pelo saleId. */
  upsertFromRemote(data: UpsertFiscalDocumentData): Promise<FiscalDocument>;
}

export const FISCAL_DOCUMENT_REPOSITORY = Symbol("FISCAL_DOCUMENT_REPOSITORY");
