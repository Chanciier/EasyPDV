import { Injectable } from "@nestjs/common";
import type { FiscalStatusPayload } from "@easypdv/shared-types";
import { BlingSyncTargetAdapter } from "../../infrastructure/adapters/bling/bling-sync-target.adapter.js";

/**
 * Chamado sob demanda pelo Histórico (POST /fiscal/sale/:saleId/reissue) —
 * descarta uma NFC-e "error" e emite uma nova, com `dhEmi` fresco. Ver
 * docblock de `BlingSyncTargetAdapter.reissueRejectedNfce`.
 */
@Injectable()
export class ReissueFiscalDocumentUseCase {
  constructor(private readonly blingSyncTargetAdapter: BlingSyncTargetAdapter) {}

  async execute(organizationId: string, saleId: string): Promise<FiscalStatusPayload> {
    const doc = await this.blingSyncTargetAdapter.reissueRejectedNfce(organizationId, saleId);
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
