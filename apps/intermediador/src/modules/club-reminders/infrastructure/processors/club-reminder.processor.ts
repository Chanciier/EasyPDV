import { Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { SendClubReminderUseCase } from "../../application/use-cases/send-club-reminder.use-case.js";
import type { ClubReminderJobData } from "../../application/ports/club-reminder-queue.port.js";
import { CLUB_REMINDER_QUEUE_NAME } from "../../club-reminders.constants.js";

@Processor(CLUB_REMINDER_QUEUE_NAME)
export class ClubReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(ClubReminderProcessor.name);

  constructor(private readonly sendClubReminderUseCase: SendClubReminderUseCase) {
    super();
  }

  async process(job: Job<ClubReminderJobData>): Promise<void> {
    this.logger.log(`Processando lembrete de clube (CPF ${job.data.customerCpf}, D-${job.data.daysBeforeExpiry})`);
    await this.sendClubReminderUseCase.execute(job.data);
  }
}
