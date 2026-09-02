import { Injectable } from "@nestjs/common";
import type { FiscalStatusPayload } from "@easypdv/shared-types";
import { BlingSyncTargetAdapter } from "../../infrastructure/adapters/bling/bling-sync-target.adapter.js";

/**
 * Chamado sob demanda pelo Histórico (POST /fiscal/sale/:saleId/retry) —
 * reenvia uma NFC-e que ficou "error". Ver docblock de
 * `BlingSyncTargetAdapter.retryFiscalDocumentManually`.
 */
@Injectable()
export class RetryFiscalDocumentUseCase {
  constructor(private readonly blingSyncTargetAdapter: BlingSyncTargetAdapter) {}

  async execute(saleId: string): Promise<FiscalStatusPayload> {
    const doc = await this.blingSyncTargetAdapter.retryFiscalDocumentManually(saleId);
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
