import { Inject, Injectable } from "@nestjs/common";
import { CUSTOMER_REPOSITORY, type CustomerRepositoryPort } from "../ports/customer-repository.port.js";
import { CustomerNotFoundError } from "../../domain/errors.js";
import type { Customer } from "../../domain/entities/customer.entity.js";

/**
 * `PATCH /admin/club/members/:document/whatsapp-consent` (painel admin,
 * Fase 2 do lembrete de renovação, 2026-09-14) — fecha o gap deixado de
 * propósito na Fase 1 ("opt-out sem UI própria"): toggle explícito de um
 * humano no painel, diferente do checkbox de cadastro (AddClubMemberUseCase),
 * que só grava opt-out quando desfaz um aceite anterior. Aqui é sempre um
 * sinal deliberado — os dois lados (marcar/desmarcar) sempre gravam
 * timestamp, sem a ambiguidade de "nunca foi perguntado".
 */
@Injectable()
export class SetWhatsappConsentUseCase {
  constructor(@Inject(CUSTOMER_REPOSITORY) private readonly customerRepository: CustomerRepositoryPort) {}

  async execute(organizationId: string, document: string, consent: boolean): Promise<Customer> {
    const customer = await this.customerRepository.findByDocument(organizationId, document);
    if (!customer) {
      throw new CustomerNotFoundError(document);
    }

    const now = new Date();
    return this.customerRepository.update(organizationId, customer.id, {
      whatsappConsentAt: consent ? now : customer.whatsappConsentAt,
      whatsappOptOutAt: consent ? null : now,
    });
  }
}
