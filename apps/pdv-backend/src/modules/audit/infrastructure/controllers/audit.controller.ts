import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../identity/infrastructure/guards/jwt-auth.guard.js";
import { RolesGuard } from "../../../identity/infrastructure/guards/roles.guard.js";
import { Roles } from "../../../identity/infrastructure/decorators/roles.decorator.js";
import { ListAuditLogsUseCase } from "../../application/use-cases/list-audit-logs.use-case.js";

/** Visibilidade restrita — trilha de auditoria não é dado operacional do dia a dia. */
@Controller("audit-logs")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("administrador", "gerente", "auditor")
export class AuditController {
  constructor(private readonly listAuditLogsUseCase: ListAuditLogsUseCase) {}

  @Get()
  list(
    @Query("entityType") entityType?: string,
    @Query("userId") userId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.listAuditLogsUseCase.execute({
      entityType,
      userId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }
}
