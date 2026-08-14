import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../identity/infrastructure/guards/jwt-auth.guard.js";
import { RolesGuard } from "../../../identity/infrastructure/guards/roles.guard.js";
import { Roles } from "../../../identity/infrastructure/decorators/roles.decorator.js";
import type { SyncOutboxStatus } from "../../domain/entities/sync-outbox-entry.entity.js";
import { ListSyncOutboxUseCase } from "../../application/use-cases/list-sync-outbox.use-case.js";

/**
 * Endpoint de visibilidade/depuração do outbox — base para a Central de Erros
 * de Sincronização (Sprint 8). Não expõe nenhuma ação de sincronização
 * manual ainda.
 */
@Controller("sync")
@UseGuards(JwtAuthGuard, RolesGuard)
export class SyncController {
  constructor(private readonly listSyncOutboxUseCase: ListSyncOutboxUseCase) {}

  @Get("outbox")
  @Roles("administrador", "gerente", "tecnico")
  list(@Query("status") status?: SyncOutboxStatus) {
    return this.listSyncOutboxUseCase.execute(status);
  }
}
