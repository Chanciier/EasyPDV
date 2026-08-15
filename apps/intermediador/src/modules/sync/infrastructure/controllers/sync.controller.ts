import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { requestSyncSchema, type RequestSyncInput } from "@easypdv/shared-validation";
import { ZodValidationPipe } from "../../../../common/pipes/zod-validation.pipe.js";
import {
  CurrentTerminal,
  type AuthenticatedTerminal,
} from "../../../organizations/infrastructure/decorators/current-terminal.decorator.js";
import { TerminalApiKeyGuard } from "../../../organizations/infrastructure/guards/terminal-api-key.guard.js";
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
 * administrador, não uma chamada de terminal — seguem sem autenticação por
 * ora (precisam de auth de admin/operador, ainda não implementada no
 * Intermediador; risco aberto e rastreado, ver Decisões e Riscos Abertos).
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
  list(@Query("status") status?: SyncJobStatus) {
    return this.listSyncJobsUseCase.execute(status);
  }

  @Get("jobs/:id")
  get(@Param("id") id: string) {
    return this.getSyncJobUseCase.execute(id);
  }

  @Post("jobs/:id/retry")
  async retry(@Param("id") id: string) {
    await this.retrySyncJobUseCase.execute(id);
    return { success: true };
  }
}
