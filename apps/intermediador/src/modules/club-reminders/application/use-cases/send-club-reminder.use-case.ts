import { Inject, Injectable, Logger } from "@nestjs/common";
import { CUSTOMER_REPOSITORY, type CustomerRepositoryPort } from "../../../customers/application/ports/customer-repository.port.js";
import { ORGANIZATION_REPOSITORY, type OrganizationRepositoryPort } from "../../../organizations/application/ports/organization-repository.port.js";
import { WhatsappProvider } from "../../../whatsapp/whatsapp.provider.js";
import { toWhatsappJid } from "../../../whatsapp/domain/whatsapp-jid.js";
import {
  CLUB_REMINDER_LOG_REPOSITORY,
  type ClubReminderLogRepositoryPort,
} from "../ports/club-reminder-log-repository.port.js";
import type { ClubReminderJobData } from "../ports/club-reminder-queue.port.js";
import { buildClubReminderMessage } from "../../domain/reminder-message.js";

/**
 * Consumidor da fila `club-reminders` (Fase 3/4, 2026-09-14) — único ponto
 * que decide "pode mandar" (`Customer.canReceiveWhatsapp`, nunca ignora
 * `whatsappOptOutAt`) e o único que grava a idempotência de verdade (a
 * constraint única em `ClubReminderLog` é quem garante "nunca duas vezes",
 * não a checagem prévia do sweep).
 *
 * Ordem deliberada (Fase 4): idempotência só é gravada DEPOIS de um envio
 * confirmado — "mensagem duplicada é o pior defeito possível" (mesma lição
 * do Saldão da Reversa), então o risco aceitável é o oposto: numa falha
 * rara entre enviar e gravar, o pior caso é reprocessar e reenviar (raro,
 * detectável), nunca "achar que enviou" sem ter enviado. Falha de envio
 * (erro real do socket) propaga pra fora — o `@Processor` do BullMQ
 * reprocessa com backoff (ver ClubReminderProcessor); "não conectado"/
 * "sem telefone válido" são condições permanentes por enquanto, não
 * adianta re-tentar em segundos, por isso não lançam.
 */
@Injectable()
export class SendClubReminderUseCase {
  private readonly logger = new Logger(SendClubReminderUseCase.name);

  constructor(
    @Inject(CUSTOMER_REPOSITORY) private readonly customerRepository: CustomerRepositoryPort,
    @Inject(ORGANIZATION_REPOSITORY) private readonly organizationRepository: OrganizationRepositoryPort,
    @Inject(CLUB_REMINDER_LOG_REPOSITORY) private readonly reminderLogRepository: ClubReminderLogRepositoryPort,
    private readonly whatsappProvider: WhatsappProvider,
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

    const jid = toWhatsappJid(customer.phone);
    if (!jid) {
      this.logger.warn(`Lembrete pulado (telefone ausente/inválido): CPF ${input.customerCpf}, D-${input.daysBeforeExpiry}.`);
      return;
    }

    if (!this.whatsappProvider.isReady(input.organizationId)) {
      this.logger.warn(
        `Lembrete pulado (WhatsApp não conectado pra organização ${input.organizationId}): CPF ${input.customerCpf}, D-${input.daysBeforeExpiry}.`,
      );
      return;
    }

    const organization = await this.organizationRepository.findById(input.organizationId);
    const message = buildClubReminderMessage(customer.name, organization?.name ?? "seu clube", input.daysBeforeExpiry, validUntil);

    await this.whatsappProvider.sendMessage(input.organizationId, jid, message);

    const recorded = await this.reminderLogRepository.record(
      input.organizationId,
      input.customerCpf,
      input.daysBeforeExpiry,
      validUntil,
    );
    if (!recorded) {
      this.logger.warn(
        `Lembrete enviado mas idempotência já existia (corrida rara): CPF ${input.customerCpf}, D-${input.daysBeforeExpiry}.`,
      );
      return;
    }

    this.logger.log(`Lembrete de WhatsApp enviado: CPF ${input.customerCpf}, D-${input.daysBeforeExpiry}.`);
  }
}
