import { Module } from "@nestjs/common";
import { AuditController } from "./infrastructure/controllers/audit.controller.js";
import { PrismaAuditLogRepository } from "./infrastructure/repositories/prisma-audit-log.repository.js";
import { AUDIT_LOG_REPOSITORY } from "./application/ports/audit-log-repository.port.js";
import { ListAuditLogsUseCase } from "./application/use-cases/list-audit-logs.use-case.js";

@Module({
  controllers: [AuditController],
  providers: [ListAuditLogsUseCase, { provide: AUDIT_LOG_REPOSITORY, useClass: PrismaAuditLogRepository }],
  // Consumido por SalesModule/IdentityModule/CatalogModule/InventoryModule
  // pra registrar eventos sensíveis (Sprint 13) — módulo folha, sem
  // dependência de nenhum dos módulos que o consomem.
  exports: [AUDIT_LOG_REPOSITORY],
})
export class AuditModule {}
