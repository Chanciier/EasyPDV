import type { FiscalDocument, FiscalDocumentStatusCode } from "../../domain/entities/fiscal-document.entity.js";
import type { ErpProviderCode } from "../../domain/entities/erp-integration.entity.js";

export interface CreateFiscalDocumentData {
  organizationId: string;
  provider: ErpProviderCode;
  saleId: string;
  externalId: string;
}

export interface UpdateFiscalDocumentData {
  status?: FiscalDocumentStatusCode;
  externalStatus?: number | null;
  documentNumber?: string | null;
  accessKey?: string | null;
  danfeUrl?: string | null;
  qrCodeUrl?: string | null;
  errorMessage?: string | null;
  issuedAt?: Date | null;
}

export interface FiscalDocumentRepositoryPort {
  findBySale(saleId: string): Promise<FiscalDocument | null>;
  create(data: CreateFiscalDocumentData): Promise<FiscalDocument>;
  update(id: string, data: UpdateFiscalDocumentData): Promise<FiscalDocument>;
}

export const FISCAL_DOCUMENT_REPOSITORY = Symbol("FISCAL_DOCUMENT_REPOSITORY");
