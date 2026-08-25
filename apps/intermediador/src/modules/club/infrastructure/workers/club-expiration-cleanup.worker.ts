import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import {
  CLUB_MEMBERSHIP_REPOSITORY,
  type ClubMembershipRepositoryPort,
} from "../../application/ports/club-membership-repository.port.js";

/**
 * Só limpa o cache local (`ClubMembership`) de linhas já vencidas — a tag
 * "Clube Saldão" no Bling é removida só pelo botão "Remover" manual (ver
 * Planejamento - Clube Saldão.md seção 5.4/5.5: validade não é editável,
 * remover é o único caminho de cancelamento/renovação). A elegibilidade em
 * si (`checkClubMembership`) já para de valer sozinha assim que `validUntil`
 * passa, só por comparação de data — este worker é limpeza, não o que faz a
 * expiração "funcionar". Primeiro uso de `@Cron` no projeto (o único job
 * periódico existente, `SyncJobReconciliationWorker`, usa `@Interval`) —
 * `ScheduleModule.forRoot()` já está registrado globalmente em app.module.ts.
 */
@Injectable()
export class ClubExpirationCleanupWorker {
  private readonly logger = new Logger(ClubExpirationCleanupWorker.name);

  constructor(@Inject(CLUB_MEMBERSHIP_REPOSITORY) private readonly clubMembershipRepository: ClubMembershipRepositoryPort) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanup() {
    const deleted = await this.clubMembershipRepository.deleteExpired(new Date());
    if (deleted > 0) {
      this.logger.log(`Limpeza do clube: ${deleted} associação(ões) vencida(s) removida(s) do cache local.`);
    }
  }
}
