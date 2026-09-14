import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { requestSyncSchema, type RequestSyncInput } from "@easypdv/shared-validation";
import { ZodValidationPipe } from "../../../../common/pipes/zod-validation.pipe.js";
import {
  CurrentTerminal,
  type AuthenticatedTerminal,
} from "../../../organizations/infrastructure/decorators/current-terminal.decorator.js";
import { TerminalApiKeyGuard } from "../../../organizations/infrastructure/guards/terminal-api-key.guard.js";
import { OrgJwtAuthGuard } from "../../../organizations/infrastructure/guards/org-jwt-auth.guard.js";
import type { SyncJobStatus } from "../../domain/entities/sync-job.entity.js";
import { RequestSyncUseCase } from "../../application/use-cases/request-sync.use-case.js";
import { GetSyncJobUseCase } from "../../application/use-cases/get-sync-job.use-case.js";
import { ListSyncJobsUseCase } from "../../application/use-cases/list-sync-jobs.use-case.js";
import { RetrySyncJobUseCase } from "../../application/use-cases/retry-sync-job.use-case.js";

/**
 * POST / (chamado pelo SyncOutboxWorker do PDV local) exige apiKey de
 * terminal válida (Sprint 10, TerminalApiKeyGuard) — fecha o risco #6 de
 * Decisões e Riscos Abertos. storeId nunca vem do body: é o do terminal
 * autenticado, não um valor que o cliente possa declarar.
 *
 * Os demais endpoints (list/retry) formam a Central de Erros de
 * Sincronização (Sprint 8) — visibilidade + retry manual pra um
 * administrador, não uma chamada de terminal. **Corrigido em 2026-09-14**
 * (achado C1 da auditoria de segurança, cofre Obsidian "Auditoria de
 * Segurança Completa — EasyPDV"): ficaram sem NENHUM guard desde sempre —
 * o comentário original dizia "precisa de auth de admin, ainda não
 * implementada", mas essa auth existe desde 2026-09-10 (`OrgJwtAuthGuard`,
 * já usada em `AdminClubController`/`AdminWhatsappController`), ninguém
 * tinha fechado o loop aqui. O payload de cada job (`SaleSyncPayload`) tem
 * CPF/nome/venda real do cliente — ficou **exposto sem credencial nenhuma
 * pra qualquer um na internet** até esta correção.
 *
 * `SyncJob` ainda não tem coluna `organizationId` (só `storeId?` opcional)
 * — não dá pra escopar por organização ainda (isso é o achado C3 da mesma
 * auditoria, correção maior/separada). Por ora, exigir login de admin já
 * fecha o vazamento público — qualquer organização autenticada ainda vê
 * jobs de todas (aceitável hoje: só existe 1 organização em produção; vira
 * bloqueador de verdade quando a 2ª conectar, junto com C3).
 */
@Controller("sync")
export class SyncController {
  constructor(
    private readonly requestSyncUseCase: RequestSyncUseCase,
    private readonly getSyncJobUseCase: GetSyncJobUseCase,
    private readonly listSyncJobsUseCase: ListSyncJobsUseCase,
    private readonly retrySyncJobUseCase: RetrySyncJobUseCase,
  ) {}

  @Post()
  @UseGuards(TerminalApiKeyGuard)
  request(
    @Body(new ZodValidationPipe(requestSyncSchema)) body: RequestSyncInput,
    @CurrentTerminal() terminal: AuthenticatedTerminal,
  ) {
    return this.requestSyncUseCase.execute({ ...body, storeId: terminal.storeId });
  }

  @Get("jobs")
  @UseGuards(OrgJwtAuthGuard)
  list(@Query("status") status?: SyncJobStatus) {
    return this.listSyncJobsUseCase.execute(status);
  }

  @Get("jobs/:id")
  @UseGuards(OrgJwtAuthGuard)
  get(@Param("id") id: string) {
    return this.getSyncJobUseCase.execute(id);
  }

  @Post("jobs/:id/retry")
  @UseGuards(OrgJwtAuthGuard)
  async retry(@Param("id") id: string) {
    await this.retrySyncJobUseCase.execute(id);
    return { success: true };
  }
}
