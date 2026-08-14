import { Injectable } from "@nestjs/common";
import { Prisma } from "../../../../generated/prisma/index.js";
import { PrismaService } from "../../../../prisma/prisma.service.js";
import type { SyncJob, SyncJobStatus } from "../../domain/entities/sync-job.entity.js";
import type {
  SyncJobRepositoryPort,
  UpsertPendingSyncJobData,
} from "../../application/ports/sync-job-repository.port.js";
import { toDomainSyncJob } from "../mappers/sync.mapper.js";

@Injectable()
export class PrismaSyncJobRepository implements SyncJobRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async upsertPending(data: UpsertPendingSyncJobData): Promise<{ job: SyncJob; isNew: boolean }> {
    const existing = await this.findByEntity(data.entityType, data.entityId);
    if (existing) {
      return { job: existing, isNew: false };
    }

    try {
      const created = await this.prisma.syncJob.create({
        data: {
          entityType: data.entityType,
          entityId: data.entityId,
          payload: data.payload as Prisma.InputJsonValue,
          storeId: data.storeId,
        },
      });
      return { job: toDomainSyncJob(created), isNew: true };
    } catch (error) {
      // Corrida rara: outra requisição criou o job entre o findByEntity e o create.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const raced = await this.findByEntity(data.entityType, data.entityId);
        if (raced) {
          return { job: raced, isNew: false };
        }
      }
      throw error;
    }
  }

  async findById(id: string): Promise<SyncJob | null> {
    const record = await this.prisma.syncJob.findUnique({ where: { id } });
    return record ? toDomainSyncJob(record) : null;
  }

  async findMany(params?: { status?: SyncJobStatus; limit?: number }): Promise<SyncJob[]> {
    const records = await this.prisma.syncJob.findMany({
      where: params?.status ? { status: params.status } : undefined,
      orderBy: { createdAt: "asc" },
      take: params?.limit ?? 100,
    });
    return records.map(toDomainSyncJob);
  }

  async findOrphanedProcessing(olderThan: Date): Promise<SyncJob[]> {
    const records = await this.prisma.syncJob.findMany({
      where: { status: "processing", updatedAt: { lt: olderThan } },
    });
    return records.map(toDomainSyncJob);
  }

  async markProcessing(id: string): Promise<void> {
    await this.prisma.syncJob.update({
      where: { id },
      data: { status: "processing", attempts: { increment: 1 } },
    });
  }

  async markSynced(id: string): Promise<void> {
    await this.prisma.syncJob.update({ where: { id }, data: { status: "synced" } });
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.prisma.syncJob.update({ where: { id }, data: { status: "failed", lastError: error } });
  }

  async resetToPending(id: string): Promise<boolean> {
    const result = await this.prisma.syncJob.updateMany({
      where: { id, status: "failed" },
      data: { status: "pending", lastError: null },
    });
    return result.count > 0;
  }

  private async findByEntity(entityType: string, entityId: string): Promise<SyncJob | null> {
    const record = await this.prisma.syncJob.findUnique({
      where: { entityType_entityId: { entityType, entityId } },
    });
    return record ? toDomainSyncJob(record) : null;
  }
}
