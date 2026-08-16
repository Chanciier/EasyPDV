import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service.js";
import type { FiscalStatusReaderPort } from "../../application/ports/fiscal-status-reader.port.js";

@Injectable()
export class PrismaFiscalStatusReader implements FiscalStatusReaderPort {
  constructor(private readonly prisma: PrismaService) {}

  async hasIssuedFiscalDocument(saleId: string): Promise<boolean> {
    const doc = await this.prisma.fiscalDocument.findUnique({
      where: { saleId },
      select: { status: true },
    });
    return doc?.status === "issued";
  }
}
