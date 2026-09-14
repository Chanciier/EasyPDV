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
 * Produtor do motor de lembrete (Fase 3, 2026-09-14) — disparado uma vez
 * por dia por `ClubReminderSweepWorker` (`@Cron`). Varre TODAS as
 * organizações de uma vez (`findExpiringBetween` sem escopo), não é
 * chamado por requisição. Consentimento de WhatsApp NÃO é checado aqui —
 * fica inteiramente em `SendClubReminderUseCase` (processor da fila), pra
 * ter um único ponto de verdade sobre "pode mandar" em vez de espalhar a
 * checagem em dois lugares.
 */
@Injectable()
export class SweepClubRemindersUseCase {
  private readonly logger = new Logger(SweepClubRemindersUseCase.name);

  constructor(
    @Inject(CLUB_MEMBERSHIP_REPOSITORY) private readonly clubMembershipRepository: ClubMembershipRepositoryPort,
    @Inject(CLUB_REMINDER_LOG_REPOSITORY) private readonly reminderLogRepository: ClubReminderLogRepositoryPort,
    @Inject(CLUB_REMINDER_QUEUE) private readonly reminderQueue: ClubReminderQueuePort,
  ) {}

  async execute(now: Date = new Date()): Promise<{ enqueued: number; skipped: number }> {
    const today = todaySaoPauloDateString(now);
    let enqueued = 0;
    let skipped = 0;

    for (const daysBefore of REMINDER_DAYS_BEFORE) {
      const targetDate = addDaysToDateString(today, daysBefore);
      const { start, end } = saoPauloDayRange(targetDate);
      const memberships = await this.clubMembershipRepository.findExpiringBetween(start, end);

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
