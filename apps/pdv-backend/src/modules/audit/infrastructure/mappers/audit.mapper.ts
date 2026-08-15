import type { AuditLog as PrismaAuditLog } from "@prisma/client";
import { AuditLog } from "../../domain/entities/audit-log.entity.js";

export function toDomainAuditLog(record: PrismaAuditLog): AuditLog {
  return new AuditLog({
    id: record.id,
    userId: record.userId,
    action: record.action,
    entityType: record.entityType,
    entityId: record.entityId,
    metadata: record.metadata ? (JSON.parse(record.metadata) as Record<string, unknown>) : null,
    createdAt: record.createdAt,
  });
}
