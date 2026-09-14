import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ErpIntegrationModule } from "../erp-integration/erp-integration.module.js";
import { CustomersModule } from "../customers/customers.module.js";
import { OrganizationsModule } from "../organizations/organizations.module.js";
import { WhatsappModule } from "../whatsapp/whatsapp.module.js";
import { SweepClubRemindersUseCase } from "./application/use-cases/sweep-club-reminders.use-case.js";
import { SendClubReminderUseCase } from "./application/use-cases/send-club-reminder.use-case.js";
import { AdminClubRemindersController } from "./infrastructure/controllers/admin-club-reminders.controller.js";
import { ClubReminderProcessor } from "./infrastructure/processors/club-reminder.processor.js";
import { PrismaClubReminderLogRepository } from "./infrastructure/repositories/prisma-club-reminder-log.repository.js";
import { BullClubReminderQueueAdapter } from "./infrastructure/queues/bull-club-reminder-queue.adapter.js";
import { CLUB_REMINDER_LOG_REPOSITORY } from "./application/ports/club-reminder-log-repository.port.js";
import { CLUB_REMINDER_QUEUE } from "./application/ports/club-reminder-queue.port.js";
import { CLUB_REMINDER_QUEUE_NAME } from "./club-reminders.constants.js";

/**
 * Motor de lembrete do Clube (Fase 3/4, 2026-09-14). Produtor
 * (`SweepClubRemindersUseCase`) disparado manualmente via
 * `AdminClubRemindersController` — pedido do usuário: sem `@Cron`
 * automático por enquanto ("não deve rodar o motor todo dia às 9h",
 * sistema novo demais). Consumidor (`ClubReminderProcessor`) continua
 * automático, reagindo à fila do BullMQ assim que algo é enfileirado.
 * `ErpIntegrationModule` é quem exporta `CLUB_MEMBERSHIP_REPOSITORY` de
 * verdade (não `ClubModule` — ver docblock de erp-integration.module.ts),
 * `CustomersModule` exporta `CUSTOMER_REPOSITORY`, `OrganizationsModule`
 * exporta `ORGANIZATION_REPOSITORY` (nome da organização, pra personalizar
 * a mensagem, e também usado pelo `OrgJwtAuthGuard` do controller —
 * strategy "jwt" já registrada globalmente, não precisa reexportar guard
 * nenhum, mesmo raciocínio de club.module.ts), `WhatsappModule` exporta
 * `WhatsappProvider` (Fase 4, canal de verdade) — mesma direção de
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
  controllers: [AdminClubRemindersController],
  providers: [
    SweepClubRemindersUseCase,
    SendClubReminderUseCase,
    ClubReminderProcessor,
    { provide: CLUB_REMINDER_LOG_REPOSITORY, useClass: PrismaClubReminderLogRepository },
    { provide: CLUB_REMINDER_QUEUE, useClass: BullClubReminderQueueAdapter },
  ],
})
export class ClubRemindersModule {}
