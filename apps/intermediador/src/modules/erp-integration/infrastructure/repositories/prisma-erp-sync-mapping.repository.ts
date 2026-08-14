import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service.js";
import type { ErpSyncMapping } from "../../domain/entities/erp-sync-mapping.entity.js";
import type { ErpProviderCode } from "../../domain/entities/erp-integration.entity.js";
import type {
  ErpSyncMappingRepositoryPort,
  UpsertErpSyncMappingData,
} from "../../application/ports/erp-sync-mapping-repository.port.js";
import { toDomainErpSyncMapping } from "../mappers/erp-integration.mapper.js";

@Injectable()
export class PrismaErpSyncMappingRepository implements ErpSyncMappingRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async find(
    organizationId: string,
    provider: ErpProviderCode,
    localEntityType: string,
    localEntityId: string,
  ): Promise<ErpSyncMapping | null> {
    const record = await this.prisma.erpSyncMapping.findUnique({
      where: {
        organizationId_provider_localEntityType_localEntityId: {
          organizationId,
          provider,
          localEntityType,
          localEntityId,
        },
      },
    });
    return record ? toDomainErpSyncMapping(record) : null;
  }

  async upsert(data: UpsertErpSyncMappingData): Promise<ErpSyncMapping> {
    const record = await this.prisma.erpSyncMapping.upsert({
      where: {
        organizationId_provider_localEntityType_localEntityId: {
          organizationId: data.organizationId,
          provider: data.provider,
          localEntityType: data.localEntityType,
          localEntityId: data.localEntityId,
        },
      },
      create: data,
      update: { externalId: data.externalId },
    });
    return toDomainErpSyncMapping(record);
  }
}
