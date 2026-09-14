export interface ClubReminderJobData {
  organizationId: string;
  customerCpf: string;
  daysBeforeExpiry: number;
  /** ISO string — BullMQ serializa job.data como JSON, `Date` não sobrevive. */
  validUntil: string;
}

export interface ClubReminderQueuePort {
  enqueue(data: ClubReminderJobData): Promise<void>;
}

export const CLUB_REMINDER_QUEUE = Symbol("CLUB_REMINDER_QUEUE");
