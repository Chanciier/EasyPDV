import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service.js";
import type { SyncOutboxStatus } from "../../domain/entities/sync-outbox-entry.entity.js";
import type { SyncOutboxRepositoryPort } from "../../application/ports/sync-outbox-repository.port.js";
import { toDomainSyncOutboxEntry } from "../mappers/sync.mapper.js";

// SLA de retry configurável fica como risco aberto (ver docs/ERROR-HANDLING.md);
// por enquanto um teto fixo evita que uma entrada quebrada seja retentada pra sempre.
const MAX_ATTEMPTS = 5;

@Injectable()
export class PrismaSyncOutboxRepository implements SyncOutboxRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const record = await this.prisma.syncOutbox.findUnique({ where: { id } });
    return record ? toDomainSyncOutboxEntry(record) : null;
  }

  async findMany(params?: { status?: SyncOutboxStatus; limit?: number }) {
    const records = await this.prisma.syncOutbox.findMany({
      where: params?.status ? { status: params.status } : undefined,
      orderBy: { createdAt: "asc" },
      take: params?.limit ?? 100,
    });
    return records.map(toDomainSyncOutboxEntry);
  }

  async markSent(id: string): Promise<void> {
    await this.prisma.syncOutbox.update({
      where: { id },
      data: { status: "synced", sentAt: new Date() },
    });
  }

  /** Incremento atômico no próprio UPDATE (sem read-modify-write); o teto vira "failed" no mesmo passo. */
  async markFailed(id: string, error: string): Promise<void> {
    const updated = await this.prisma.syncOutbox.update({
      where: { id },
      data: { attempts: { increment: 1 }, lastError: error },
      select: { attempts: true },
    });
    if (updated.attempts >= MAX_ATTEMPTS) {
      await this.prisma.syncOutbox.update({ where: { id }, data: { status: "failed" } });
    }
  }

  async recordTransientError(id: string, error: string): Promise<void> {
    await this.prisma.syncOutbox.update({ where: { id }, data: { lastError: error } });
  }

  countByStatus(status: SyncOutboxStatus): Promise<number> {
    return this.prisma.syncOutbox.count({ where: { status } });
  }

  async resetToPending(id: string): Promise<boolean> {
    const result = await this.prisma.syncOutbox.updateMany({
      where: { id, status: "failed" },
      data: { status: "pending", attempts: 0, lastError: null },
    });
    return result.count > 0;
  }
}
