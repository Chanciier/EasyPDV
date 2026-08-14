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

  async markFailed(id: string, error: string): Promise<void> {
    const current = await this.prisma.syncOutbox.findUniqueOrThrow({ where: { id } });
    const attempts = current.attempts + 1;
    await this.prisma.syncOutbox.update({
      where: { id },
      data: {
        attempts,
        lastError: error,
        status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
      },
    });
  }
}
