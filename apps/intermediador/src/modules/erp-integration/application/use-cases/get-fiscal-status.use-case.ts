import { Injectable } from "@nestjs/common";
import type { FiscalStatusPayload } from "@easypdv/shared-types";
import { FiscalDocumentNotFoundError } from "../../domain/errors.js";
import { BlingSyncTargetAdapter } from "../../infrastructure/adapters/bling/bling-sync-target.adapter.js";

/**
 * Consultado pelo PDV local (GET /fiscal/sale/:saleId, em polling) pra
 * espelhar o status fiscal no seu próprio FiscalDocument (SQLite). Reconsulta
 * o Bling primeiro via `refreshFiscalStatus` (só faz chamada nova se ainda
 * estiver "pending" — ver comentário lá) pra não devolver pro PDV um status
 * preso no que foi visto uma única vez no momento do sync.
 */
@Injectable()
export class GetFiscalStatusUseCase {
  constructor(private readonly blingSyncTargetAdapter: BlingSyncTargetAdapter) {}

  async execute(saleId: string): Promise<FiscalStatusPayload> {
    const doc = await this.blingSyncTargetAdapter.refreshFiscalStatus(saleId);
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
