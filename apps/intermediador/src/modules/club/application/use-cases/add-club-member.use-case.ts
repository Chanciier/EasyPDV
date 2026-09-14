import { Inject, Injectable } from "@nestjs/common";
import { onlyDigits } from "@easypdv/shared-validation";
import { BlingSyncTargetAdapter } from "../../../erp-integration/infrastructure/adapters/bling/bling-sync-target.adapter.js";
import { CUSTOMER_REPOSITORY, type CustomerRepositoryPort } from "../../../customers/application/ports/customer-repository.port.js";
import type { ClubMemberSummary } from "../../domain/entities/club-member-summary.js";

/**
 * Cadastro/renovação de sócio (2026-09-14, Fase 1 do lembrete de renovação)
 * — além do que já fazia (escrever nome/celular no contato do Bling +
 * upsert de ClubMembership), agora também espelha nome/telefone no
 * `Customer` central (mesmo padrão "Bling sempre vence" do import recorrente
 * — ver ImportCustomersFromBlingUseCase) e grava o consentimento de
 * WhatsApp. Sem isso, o telefone só existia dentro do contato do Bling —
 * era exatamente o gap que o backfill via Bling fechou pros clientes
 * existentes; aqui fecha pra cadastros novos, na origem.
 */
@Injectable()
export class AddClubMemberUseCase {
  constructor(
    private readonly blingSyncTargetAdapter: BlingSyncTargetAdapter,
    @Inject(CUSTOMER_REPOSITORY) private readonly customerRepository: CustomerRepositoryPort,
  ) {}

  async execute(
    organizationId: string,
    name: string,
    document: string,
    validUntil: string,
    phone: string,
    whatsappConsent: boolean,
  ): Promise<ClubMemberSummary> {
    const normalizedDocument = onlyDigits(document);
    const summary = await this.blingSyncTargetAdapter.addClubMember(
      organizationId,
      name,
      normalizedDocument,
      new Date(validUntil),
      phone,
    );

    const existing = await this.customerRepository.findByDocument(organizationId, normalizedDocument);
    const now = new Date();
    // Nunca fabrica uma revogação pra quem nunca deu aceite — só marca
    // whatsappOptOutAt quando existe um whatsappConsentAt anterior sendo
    // desfeito agora. Ver docblock de Customer.canReceiveWhatsapp.
    let whatsappConsentAt = existing?.whatsappConsentAt ?? null;
    let whatsappOptOutAt = existing?.whatsappOptOutAt ?? null;
    if (whatsappConsent) {
      whatsappConsentAt = now;
      whatsappOptOutAt = null;
    } else if (whatsappConsentAt) {
      whatsappOptOutAt = now;
    }

    if (existing) {
      await this.customerRepository.update(organizationId, existing.id, { name, phone, whatsappConsentAt, whatsappOptOutAt });
    } else {
      await this.customerRepository.create({
        organizationId,
        name,
        document: normalizedDocument,
        phone,
        email: null,
        whatsappConsentAt,
        whatsappOptOutAt,
      });
    }

    return summary;
  }
}
