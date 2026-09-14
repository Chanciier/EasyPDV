import { Inject, Injectable, Logger } from "@nestjs/common";
import { CUSTOMER_REPOSITORY, type CustomerRepositoryPort } from "../../../customers/application/ports/customer-repository.port.js";
import {
  CLUB_REMINDER_LOG_REPOSITORY,
  type ClubReminderLogRepositoryPort,
} from "../ports/club-reminder-log-repository.port.js";
import type { ClubReminderJobData } from "../ports/club-reminder-queue.port.js";

/**
 * Consumidor da fila `club-reminders` (Fase 3, 2026-09-14) — único ponto
 * que decide "pode mandar" (`Customer.canReceiveWhatsapp`, nunca ignora
 * `whatsappOptOutAt`) e o único que grava a idempotência de verdade (a
 * constraint única em `ClubReminderLog` é quem garante "nunca duas vezes",
 * não a checagem prévia do sweep). Sem canal ainda ("mensagem duplicada é
 * o pior defeito possível", mesma lição do Saldão da Reversa) — por
 * enquanto só loga o que SERIA enviado; Fase 4 troca o log por
 * `WhatsappProvider.sendMessage` de verdade neste mesmo lugar, sem mexer
 * na lógica de janela/consentimento/idempotência daqui.
 */
@Injectable()
export class SendClubReminderUseCase {
  private readonly logger = new Logger(SendClubReminderUseCase.name);

  constructor(
    @Inject(CUSTOMER_REPOSITORY) private readonly customerRepository: CustomerRepositoryPort,
    @Inject(CLUB_REMINDER_LOG_REPOSITORY) private readonly reminderLogRepository: ClubReminderLogRepositoryPort,
  ) {}

  async execute(input: ClubReminderJobData): Promise<void> {
    const validUntil = new Date(input.validUntil);
    const customer = await this.customerRepository.findByDocument(input.organizationId, input.customerCpf);

    if (!customer?.canReceiveWhatsapp) {
      this.logger.log(
        `Lembrete pulado (sem consentimento de WhatsApp): CPF ${input.customerCpf}, D-${input.daysBeforeExpiry}.`,
      );
      return;
    }

    const recorded = await this.reminderLogRepository.record(
      input.organizationId,
      input.customerCpf,
      input.daysBeforeExpiry,
      validUntil,
    );
    if (!recorded) {
      this.logger.log(`Lembrete já enviado antes, ignorando duplicata: CPF ${input.customerCpf}, D-${input.daysBeforeExpiry}.`);
      return;
    }

    this.logger.log(
      `[LEMBRETE] Enviaria WhatsApp pra ${customer.name} (${customer.phone}) — clube vence em ` +
        `${input.daysBeforeExpiry} dia(s), ${validUntil.toLocaleDateString("pt-BR")}.`,
    );
  }
}
