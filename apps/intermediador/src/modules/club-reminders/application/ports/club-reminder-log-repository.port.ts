export interface ClubReminderLogRepositoryPort {
  exists(organizationId: string, customerCpf: string, daysBeforeExpiry: number, validUntil: Date): Promise<boolean>;
  /**
   * Grava a idempotência. `false` = já existia (constraint única bateu) —
   * quem chama trata como "já enviado antes", nunca lança. Esta é a garantia
   * de verdade contra duplicata (ver docblock de ClubReminderLog no
   * schema.prisma); a checagem prévia em SweepClubRemindersUseCase só evita
   * enfileirar de novo, não é a fonte da garantia.
   */
  record(organizationId: string, customerCpf: string, daysBeforeExpiry: number, validUntil: Date): Promise<boolean>;
}

export const CLUB_REMINDER_LOG_REPOSITORY = Symbol("CLUB_REMINDER_LOG_REPOSITORY");
