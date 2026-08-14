import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { requestSyncSchema, type RequestSyncInput } from "@easypdv/shared-validation";
import { ZodValidationPipe } from "../../../../common/pipes/zod-validation.pipe.js";
import { RequestSyncUseCase } from "../../application/use-cases/request-sync.use-case.js";
import { GetSyncJobUseCase } from "../../application/use-cases/get-sync-job.use-case.js";

/**
 * Chamado pelo SyncOutboxWorker do PDV local. Sem autenticação por enquanto —
 * provisionamento de terminal (Sprint 10) e autenticação PDV local ↔
 * Intermediador ainda não existem, risco aberto e rastreado. Ver
 * Claude/Projetos/EasyPDV/Decisões e Riscos Abertos.md no cofre Obsidian.
 */
@Controller("sync")
export class SyncController {
  constructor(
    private readonly requestSyncUseCase: RequestSyncUseCase,
    private readonly getSyncJobUseCase: GetSyncJobUseCase,
  ) {}

  @Post()
  request(@Body(new ZodValidationPipe(requestSyncSchema)) body: RequestSyncInput) {
    return this.requestSyncUseCase.execute(body);
  }

  @Get("jobs/:id")
  get(@Param("id") id: string) {
    return this.getSyncJobUseCase.execute(id);
  }
}
