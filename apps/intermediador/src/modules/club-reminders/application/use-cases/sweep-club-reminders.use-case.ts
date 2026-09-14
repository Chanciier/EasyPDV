import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  CLUB_MEMBERSHIP_REPOSITORY,
  type ClubMembershipRepositoryPort,
} from "../../../club/application/ports/club-membership-repository.port.js";
import {
  CLUB_REMINDER_LOG_REPOSITORY,
  type ClubReminderLogRepositoryPort,
} from "../ports/club-reminder-log-repository.port.js";
import { CLUB_REMINDER_QUEUE, type ClubReminderQueuePort } from "../ports/club-reminder-queue.port.js";
import { REMINDER_DAYS_BEFORE } from "../../club-reminders.constants.js";
import { addDaysToDateString, saoPauloDayRange, todaySaoPauloDateString } from "../../domain/sao-paulo-date.js";

/**
 * Produtor do motor de lembrete (Fase 3, 2026-09-14) — disparado manualmente
 * (`AdminClubRemindersController`, pedido do usuário: "não deve rodar o
 * motor todo dia às 9h", sistema novo demais pra confiar em automático
 * ainda — sem `@Cron`, o gatilho antigo `ClubReminderSweepWorker` foi
 * removido). `organizationId` opcional: o painel admin sempre passa a
 * própria organização de quem chamou (nunca deixa um admin disparar
 * lembrete de outra organização); omitido = sem filtro, varre TODAS (só
 * relevante se um gatilho global voltar a existir no futuro). Consentimento
 * de WhatsApp NÃO é checado aqui — fica inteiramente em
 * `SendClubReminderUseCase` (processor da fila), pra ter um único ponto de
 * verdade sobre "pode mandar" em vez de espalhar a checagem em dois lugares.
 */
@Injectable()
export class SweepClubRemindersUseCase {
  private readonly logger = new Logger(SweepClubRemindersUseCase.name);

  constructor(
    @Inject(CLUB_MEMBERSHIP_REPOSITORY) private readonly clubMembershipRepository: ClubMembershipRepositoryPort,
    @Inject(CLUB_REMINDER_LOG_REPOSITORY) private readonly reminderLogRepository: ClubReminderLogRepositoryPort,
    @Inject(CLUB_REMINDER_QUEUE) private readonly reminderQueue: ClubReminderQueuePort,
  ) {}

  async execute(organizationId?: string, now: Date = new Date()): Promise<{ enqueued: number; skipped: number }> {
    const today = todaySaoPauloDateString(now);
    let enqueued = 0;
    let skipped = 0;

    for (const daysBefore of REMINDER_DAYS_BEFORE) {
      const targetDate = addDaysToDateString(today, daysBefore);
      const { start, end } = saoPauloDayRange(targetDate);
      const memberships = await this.clubMembershipRepository.findExpiringBetween(start, end, organizationId);

      for (const membership of memberships) {
        const alreadyLogged = await this.reminderLogRepository.exists(
          membership.organizationId,
          membership.customerCpf,
          daysBefore,
          membership.validUntil,
        );
        if (alreadyLogged) {
          skipped++;
          continue;
        }

        await this.reminderQueue.enqueue({
          organizationId: membership.organizationId,
          customerCpf: membership.customerCpf,
          daysBeforeExpiry: daysBefore,
          validUntil: membership.validUntil.toISOString(),
        });
        enqueued++;
      }
    }

    this.logger.log(`Varredura de lembretes do clube: ${enqueued} enfileirado(s), ${skipped} já enviado(s) antes.`);
    return { enqueued, skipped };
  }
}
