import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service.js";
import type { FiscalDocument } from "../../domain/entities/fiscal-document.entity.js";
import type {
  FiscalDocumentRepositoryPort,
  UpsertFiscalDocumentData,
} from "../../application/ports/fiscal-document-repository.port.js";
import { toDomainFiscalDocument } from "../mappers/fiscal.mapper.js";

@Injectable()
export class PrismaFiscalDocumentRepository implements FiscalDocumentRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findBySale(saleId: string): Promise<FiscalDocument | null> {
    const record = await this.prisma.fiscalDocument.findUnique({ where: { saleId } });
    return record ? toDomainFiscalDocument(record) : null;
  }

  async upsertFromRemote(data: UpsertFiscalDocumentData): Promise<FiscalDocument> {
    const record = await this.prisma.fiscalDocument.upsert({
      where: { saleId: data.saleId },
      create: data,
      update: {
        type: data.type,
        status: data.status,
        documentNumber: data.documentNumber,
        accessKey: data.accessKey,
        danfeUrl: data.danfeUrl,
        errorMessage: data.errorMessage,
        issuedAt: data.issuedAt,
      },
    });
    return toDomainFiscalDocument(record);
  }
}
