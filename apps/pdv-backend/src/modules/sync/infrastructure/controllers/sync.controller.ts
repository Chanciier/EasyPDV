import { Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../identity/infrastructure/guards/jwt-auth.guard.js";
import { RolesGuard } from "../../../identity/infrastructure/guards/roles.guard.js";
import { Roles } from "../../../identity/infrastructure/decorators/roles.decorator.js";
import type { SyncOutboxStatus } from "../../domain/entities/sync-outbox-entry.entity.js";
import { ListSyncOutboxUseCase } from "../../application/use-cases/list-sync-outbox.use-case.js";
import { RetrySyncOutboxEntryUseCase } from "../../application/use-cases/retry-sync-outbox-entry.use-case.js";
import { GetSyncStatusUseCase } from "../../application/use-cases/get-sync-status.use-case.js";

/** Central de Erros de Sincronização (Sprint 8): visibilidade do outbox + retry manual. */
@Controller("sync")
@UseGuards(JwtAuthGuard, RolesGuard)
export class SyncController {
  constructor(
    private readonly listSyncOutboxUseCase: ListSyncOutboxUseCase,
    private readonly retrySyncOutboxEntryUseCase: RetrySyncOutboxEntryUseCase,
    private readonly getSyncStatusUseCase: GetSyncStatusUseCase,
  ) {}

  /** Sem @Roles de propósito — "modo contingência" básico, qualquer operador precisa ver isso (Sprint 15). */
  @Get("status")
  status() {
    return this.getSyncStatusUseCase.execute();
  }

  @Get("outbox")
  @Roles("administrador", "gerente", "tecnico")
  list(@Query("status") status?: SyncOutboxStatus) {
    return this.listSyncOutboxUseCase.execute(status);
  }

  @Post("outbox/:id/retry")
  @Roles("administrador", "gerente", "tecnico")
  async retry(@Param("id") id: string) {
    await this.retrySyncOutboxEntryUseCase.execute(id);
    return { success: true };
  }
}
