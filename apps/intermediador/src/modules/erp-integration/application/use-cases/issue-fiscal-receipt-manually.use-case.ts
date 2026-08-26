import { Injectable } from "@nestjs/common";
import type { FiscalStatusPayload } from "@easypdv/shared-types";
import { BlingSyncTargetAdapter } from "../../infrastructure/adapters/bling/bling-sync-target.adapter.js";

/**
 * Chamado sob demanda pelo Histórico (POST /fiscal/sale/:saleId/issue) —
 * emite NFC-e de verdade pra uma venda que foi confirmada sem CPF (só tinha
 * um comprovante local até aqui). Ver docblock de
 * `BlingSyncTargetAdapter.issueFiscalReceiptManually`.
 */
@Injectable()
export class IssueFiscalReceiptManuallyUseCase {
  constructor(private readonly blingSyncTargetAdapter: BlingSyncTargetAdapter) {}

  async execute(organizationId: string, saleId: string): Promise<FiscalStatusPayload> {
    const doc = await this.blingSyncTargetAdapter.issueFiscalReceiptManually(organizationId, saleId);
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
