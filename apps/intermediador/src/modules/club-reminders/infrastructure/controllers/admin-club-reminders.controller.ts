import { Controller, Post, UseGuards } from "@nestjs/common";
import { OrgJwtAuthGuard } from "../../../organizations/infrastructure/guards/org-jwt-auth.guard.js";
import {
  CurrentOrgUser,
  type AuthenticatedOrgUser,
} from "../../../organizations/infrastructure/decorators/current-org-user.decorator.js";
import { SweepClubRemindersUseCase } from "../../application/use-cases/sweep-club-reminders.use-case.js";

/**
 * Disparo manual do motor de lembrete (2026-09-14) — pedido explícito do
 * usuário: nada de `@Cron` automático ainda ("não deve rodar o motor todo
 * dia às 9h"), o sistema é novo demais e quase ninguém tem consentimento
 * de verdade. `SweepClubRemindersUseCase` continua igual (idempotência,
 * janela D-7/D-1 em calendário de São Paulo, consentimento checado no
 * consumidor da fila) — só o GATILHO deixou de ser automático. Mesma
 * fronteira de confiança de `AdminClubController`/`AdminWhatsappController`
 * (`OrgJwtAuthGuard`, painel admin, nunca terminal). `organizationId`
 * sempre do token — nunca deixa um admin disparar lembrete de outra
 * organização.
 */
@Controller("admin/club-reminders")
@UseGuards(OrgJwtAuthGuard)
export class AdminClubRemindersController {
  constructor(private readonly sweepClubRemindersUseCase: SweepClubRemindersUseCase) {}

  @Post("sweep")
  sweep(@CurrentOrgUser() user: AuthenticatedOrgUser) {
    return this.sweepClubRemindersUseCase.execute(user.organizationId);
  }
}
