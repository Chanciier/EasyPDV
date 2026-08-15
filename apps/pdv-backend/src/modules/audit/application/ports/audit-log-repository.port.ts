import type { AuditLog } from "../../domain/entities/audit-log.entity.js";

export interface RecordAuditLogData {
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown> | null;
}

export interface ListAuditLogsFilters {
  entityType?: string;
  userId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}

export interface AuditLogRepositoryPort {
  /**
   * Não-transacional por padrão — chamada logo após a ação principal ter
   * sucesso. `sale.confirmed` é a exceção: gravado direto dentro do
   * `$transaction` de `PrismaSaleRepository.confirm()`, não passa por aqui.
   */
  record(data: RecordAuditLogData): Promise<void>;
  list(filters: ListAuditLogsFilters): Promise<AuditLog[]>;
}

export const AUDIT_LOG_REPOSITORY = Symbol("AUDIT_LOG_REPOSITORY");
