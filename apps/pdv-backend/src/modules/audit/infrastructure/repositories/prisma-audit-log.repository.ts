import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service.js";
import type { AuditLog } from "../../domain/entities/audit-log.entity.js";
import type {
  AuditLogRepositoryPort,
  ListAuditLogsFilters,
  RecordAuditLogData,
} from "../../application/ports/audit-log-repository.port.js";
import { toDomainAuditLog } from "../mappers/audit.mapper.js";

const DEFAULT_LIMIT = 100;

@Injectable()
export class PrismaAuditLogRepository implements AuditLogRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async record(data: RecordAuditLogData): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      },
    });
  }

  async list(filters: ListAuditLogsFilters): Promise<AuditLog[]> {
    const records = await this.prisma.auditLog.findMany({
      where: {
        entityType: filters.entityType,
        userId: filters.userId,
        createdAt: filters.from || filters.to ? { gte: filters.from, lte: filters.to } : undefined,
      },
      orderBy: { createdAt: "desc" },
      take: filters.limit ?? DEFAULT_LIMIT,
    });
    return records.map(toDomainAuditLog);
  }
}
