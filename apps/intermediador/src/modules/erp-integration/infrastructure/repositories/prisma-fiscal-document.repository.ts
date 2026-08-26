import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service.js";
import type { FiscalDocument } from "../../domain/entities/fiscal-document.entity.js";
import type {
  CreateFiscalDocumentData,
  FiscalDocumentRepositoryPort,
  UpdateFiscalDocumentData,
} from "../../application/ports/fiscal-document-repository.port.js";
import { toDomainFiscalDocument } from "../mappers/erp-integration.mapper.js";

@Injectable()
export class PrismaFiscalDocumentRepository implements FiscalDocumentRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findBySale(saleId: string): Promise<FiscalDocument | null> {
    const record = await this.prisma.fiscalDocument.findFirst({ where: { saleId } });
    return record ? toDomainFiscalDocument(record) : null;
  }

  async create(data: CreateFiscalDocumentData): Promise<FiscalDocument> {
    const record = await this.prisma.fiscalDocument.create({ data });
    return toDomainFiscalDocument(record);
  }

  async update(id: string, data: UpdateFiscalDocumentData): Promise<FiscalDocument> {
    const record = await this.prisma.fiscalDocument.update({ where: { id }, data });
    return toDomainFiscalDocument(record);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.fiscalDocument.delete({ where: { id } });
  }
}
