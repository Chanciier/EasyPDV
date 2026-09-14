import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import type { ClubReminderJobData, ClubReminderQueuePort } from "../../application/ports/club-reminder-queue.port.js";
import { CLUB_REMINDER_JOB_NAME, CLUB_REMINDER_QUEUE_NAME } from "../../club-reminders.constants.js";

/**
 * `@Processor` (ver club-reminder.processor.ts) roda com concorrência
 * padrão (1) — jobs desta fila já saem sequenciais, "nunca rajada" fica
 * garantido sem precisar de delay artificial aqui. Retry moderado (3
 * tentativas): falha aqui hoje só pode ser erro do Postgres, não de API
 * externa nenhuma (sem canal ainda) — não precisa do backoff generoso de
 * `BullSyncQueueAdapter` (5 tentativas, pensado pra falha do Bling).
 * Revisitar quando a Fase 4 trocar o corpo do job por um envio real.
 */
@Injectable()
export class BullClubReminderQueueAdapter implements ClubReminderQueuePort {
  constructor(@InjectQueue(CLUB_REMINDER_QUEUE_NAME) private readonly queue: Queue) {}

  async enqueue(data: ClubReminderJobData): Promise<void> {
    await this.queue.add(CLUB_REMINDER_JOB_NAME, data, { attempts: 3, backoff: { type: "exponential", delay: 5000 } });
  }
}
