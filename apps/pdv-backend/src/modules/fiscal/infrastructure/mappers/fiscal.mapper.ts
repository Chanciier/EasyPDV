import type { FiscalDocument as PrismaFiscalDocument } from "@prisma/client";
import { FiscalDocument } from "../../domain/entities/fiscal-document.entity.js";

export function toDomainFiscalDocument(record: PrismaFiscalDocument): FiscalDocument {
  return new FiscalDocument({
    id: record.id,
    saleId: record.saleId,
    type: record.type,
    status: record.status,
    documentNumber: record.documentNumber,
    accessKey: record.accessKey,
    danfeUrl: record.danfeUrl,
    errorMessage: record.errorMessage,
    issuedAt: record.issuedAt,
    updatedAt: record.updatedAt,
  });
}
