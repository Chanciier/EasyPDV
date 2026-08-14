import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { requestSyncSchema, type RequestSyncInput } from "@easypdv/shared-validation";
import { ZodValidationPipe } from "../../../../common/pipes/zod-validation.pipe.js";
import type { SyncJobStatus } from "../../domain/entities/sync-job.entity.js";
import { RequestSyncUseCase } from "../../application/use-cases/request-sync.use-case.js";
import { GetSyncJobUseCase } from "../../application/use-cases/get-sync-job.use-case.js";
import { ListSyncJobsUseCase } from "../../application/use-cases/list-sync-jobs.use-case.js";
import { RetrySyncJobUseCase } from "../../application/use-cases/retry-sync-job.use-case.js";

/**
 * Chamado pelo SyncOutboxWorker do PDV local (POST /sync). Os demais
 * endpoints (list/retry) formam a Central de Erros de Sincronização
 * (Sprint 8) — visibilidade + retry manual, sem cura automática silenciosa.
 * Sem autenticação por enquanto — provisionamento de terminal (Sprint 10) e
 * autenticação PDV local ↔ Intermediador ainda não existem, risco aberto e
 * rastreado. Ver Claude/Projetos/EasyPDV/Decisões e Riscos Abertos.md no
 * cofre Obsidian.
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
  request(@Body(new ZodValidationPipe(requestSyncSchema)) body: RequestSyncInput) {
    return this.requestSyncUseCase.execute(body);
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
