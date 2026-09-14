import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { SweepClubRemindersUseCase } from "../../application/use-cases/sweep-club-reminders.use-case.js";

/**
 * Gatilho diário do motor de lembrete (Fase 3, 2026-09-14). 9h horário de
 * Brasília — já nasce no horário que a Fase 4 vai usar de verdade pro
 * envio (não faz sentido rodar de madrugada agora e trocar depois).
 * `timeZone` explícito: sem isso `@Cron` roda no fuso do PROCESSO (Railway
 * = UTC), e "hoje" pro cálculo de D-7/D-1 (ver sao-paulo-date.ts) ficaria
 * errado perto da virada do dia — mesma classe do bug de fuso já corrigido
 * no cadastro do Clube em v1.5.13.
 */
@Injectable()
export class ClubReminderSweepWorker {
  constructor(private readonly sweepClubRemindersUseCase: SweepClubRemindersUseCase) {}

  @Cron("0 9 * * *", { timeZone: "America/Sao_Paulo" })
  async sweep(): Promise<void> {
    await this.sweepClubRemindersUseCase.execute();
  }
}
