import { Inject, Injectable } from "@nestjs/common";
import type { AuditLog } from "../../domain/entities/audit-log.entity.js";
import {
  AUDIT_LOG_REPOSITORY,
  type AuditLogRepositoryPort,
  type ListAuditLogsFilters,
} from "../ports/audit-log-repository.port.js";

@Injectable()
export class ListAuditLogsUseCase {
  constructor(@Inject(AUDIT_LOG_REPOSITORY) private readonly auditLogRepository: AuditLogRepositoryPort) {}

  execute(filters: ListAuditLogsFilters): Promise<AuditLog[]> {
    return this.auditLogRepository.list(filters);
  }
}
