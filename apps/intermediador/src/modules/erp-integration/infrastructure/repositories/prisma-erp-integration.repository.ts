import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service.js";
import type { ErpIntegration, ErpProviderCode } from "../../domain/entities/erp-integration.entity.js";
import type {
  ErpIntegrationRepositoryPort,
  UpsertErpIntegrationData,
} from "../../application/ports/erp-integration-repository.port.js";
import { toDomainErpIntegration } from "../mappers/erp-integration.mapper.js";

@Injectable()
export class PrismaErpIntegrationRepository implements ErpIntegrationRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(data: UpsertErpIntegrationData): Promise<ErpIntegration> {
    const record = await this.prisma.erpIntegration.upsert({
      where: { organizationId_provider: { organizationId: data.organizationId, provider: data.provider } },
      create: data,
      update: {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt,
      },
    });
    return toDomainErpIntegration(record);
  }

  async findByOrganization(organizationId: string, provider: ErpProviderCode): Promise<ErpIntegration | null> {
    const record = await this.prisma.erpIntegration.findUnique({
      where: { organizationId_provider: { organizationId, provider } },
    });
    return record ? toDomainErpIntegration(record) : null;
  }

  async findFirstActive(provider: ErpProviderCode): Promise<ErpIntegration | null> {
    const record = await this.prisma.erpIntegration.findFirst({
      where: { provider },
      orderBy: { connectedAt: "asc" },
    });
    return record ? toDomainErpIntegration(record) : null;
  }
}
