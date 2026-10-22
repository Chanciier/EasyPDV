import { Inject, Injectable, Logger } from "@nestjs/common";
import { toErrorMessage } from "../../../../common/to-error-message.js";
import { PrismaService } from "../../../../prisma/prisma.service.js";
import { FISCAL_GATEWAY, type FiscalGatewayPort } from "../../../fiscal/application/ports/fiscal-gateway.port.js";
import {
  FISCAL_DOCUMENT_REPOSITORY,
  type FiscalDocumentRepositoryPort,
} from "../../../fiscal/application/ports/fiscal-document-repository.port.js";
import type { FiscalStatusReaderPort, NfceIssuedCheck } from "../../application/ports/fiscal-status-reader.port.js";

function isIssuedNfce(doc: { type: string; status: string } | null | undefined): boolean {
  return doc?.type === "nfce" && doc.status === "issued";
}

/**
 * Remoto primeiro (só quando pedido), espelho local como fallback — mesma
 * ideia de GetFiscalStatusUseCase, mas aqui a falha da central vira
 * `"unknown"` em vez de "sem nota": o chamador decide bloquear.
 */
@Injectable()
export class PrismaFiscalStatusReader implements FiscalStatusReaderPort {
  private readonly logger = new Logger(PrismaFiscalStatusReader.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(FISCAL_GATEWAY) private readonly fiscalGateway: FiscalGatewayPort,
    @Inject(FISCAL_DOCUMENT_REPOSITORY) private readonly fiscalDocumentRepository: FiscalDocumentRepositoryPort,
  ) {}

  async checkIssuedNfce(saleId: string, options: { refreshRemote: boolean }): Promise<NfceIssuedCheck> {
    const local = await this.prisma.fiscalDocument.findUnique({
      where: { saleId },
      select: { type: true, status: true },
    });
    if (isIssuedNfce(local)) {
      return "nfce_issued";
    }
    if (!options.refreshRemote) {
      return "none";
    }

    try {
      const remote = await this.fiscalGateway.fetchStatus(saleId);
      if (!remote) {
        return "none";
      }
      await this.fiscalDocumentRepository.upsertFromRemote({
        saleId,
        ...remote,
        issuedAt: remote.issuedAt ? new Date(remote.issuedAt) : null,
      });
      return isIssuedNfce(remote) ? "nfce_issued" : "none";
    } catch (error) {
      this.logger.warn(`Estorno: status fiscal da venda ${saleId} indisponível na central: ${toErrorMessage(error)}`);
      return "unknown";
    }
  }
}
