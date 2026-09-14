import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ErpIntegrationModule } from "../erp-integration/erp-integration.module.js";
import { CustomersModule } from "../customers/customers.module.js";
import { OrganizationsModule } from "../organizations/organizations.module.js";
import { WhatsappModule } from "../whatsapp/whatsapp.module.js";
import { SweepClubRemindersUseCase } from "./application/use-cases/sweep-club-reminders.use-case.js";
import { SendClubReminderUseCase } from "./application/use-cases/send-club-reminder.use-case.js";
import { ClubReminderSweepWorker } from "./infrastructure/workers/club-reminder-sweep.worker.js";
import { ClubReminderProcessor } from "./infrastructure/processors/club-reminder.processor.js";
import { PrismaClubReminderLogRepository } from "./infrastructure/repositories/prisma-club-reminder-log.repository.js";
import { BullClubReminderQueueAdapter } from "./infrastructure/queues/bull-club-reminder-queue.adapter.js";
import { CLUB_REMINDER_LOG_REPOSITORY } from "./application/ports/club-reminder-log-repository.port.js";
import { CLUB_REMINDER_QUEUE } from "./application/ports/club-reminder-queue.port.js";
import { CLUB_REMINDER_QUEUE_NAME } from "./club-reminders.constants.js";

/**
 * Motor de lembrete do Clube (Fase 3/4, 2026-09-14) — sem controller nenhum,
 * de propósito: nada aqui é chamado por requisição HTTP, só pelo `@Cron`
 * (produtor) e pelo `@Processor` do BullMQ (consumidor). `ErpIntegrationModule`
 * é quem exporta `CLUB_MEMBERSHIP_REPOSITORY` de verdade (não `ClubModule`
 * — ver docblock de erp-integration.module.ts), `CustomersModule` exporta
 * `CUSTOMER_REPOSITORY`, `OrganizationsModule` exporta `ORGANIZATION_REPOSITORY`
 * (nome da organização, pra personalizar a mensagem), `WhatsappModule`
 * exporta `WhatsappProvider` (Fase 4, canal de verdade) — mesma direção de
 * dependência já usada em ClubModule/StoreCreditModule (feature puxa de
 * outro módulo).
 */
@Module({
  imports: [
    BullModule.registerQueue({ name: CLUB_REMINDER_QUEUE_NAME }),
    ErpIntegrationModule,
    CustomersModule,
    OrganizationsModule,
    WhatsappModule,
  ],
  providers: [
    SweepClubRemindersUseCase,
    SendClubReminderUseCase,
    ClubReminderSweepWorker,
    ClubReminderProcessor,
    { provide: CLUB_REMINDER_LOG_REPOSITORY, useClass: PrismaClubReminderLogRepository },
    { provide: CLUB_REMINDER_QUEUE, useClass: BullClubReminderQueueAdapter },
  ],
})
export class ClubRemindersModule {}
