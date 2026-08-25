import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service.js";
import type { ErpProviderCode } from "../../../erp-integration/domain/entities/erp-integration.entity.js";
import type { ClubMembership } from "../../domain/entities/club-membership.entity.js";
import type {
  ClubMembershipRepositoryPort,
  UpsertClubMembershipData,
} from "../../application/ports/club-membership-repository.port.js";
import { toDomainClubMembership } from "../mappers/club.mapper.js";

@Injectable()
export class PrismaClubMembershipRepository implements ClubMembershipRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findByCpf(organizationId: string, provider: ErpProviderCode, customerCpf: string): Promise<ClubMembership | null> {
    const record = await this.prisma.clubMembership.findUnique({
      where: { organizationId_provider_customerCpf: { organizationId, provider, customerCpf } },
    });
    return record ? toDomainClubMembership(record) : null;
  }

  async upsert(data: UpsertClubMembershipData): Promise<ClubMembership> {
    const record = await this.prisma.clubMembership.upsert({
      where: {
        organizationId_provider_customerCpf: {
          organizationId: data.organizationId,
          provider: data.provider,
          customerCpf: data.customerCpf,
        },
      },
      create: data,
      update: { validUntil: data.validUntil },
    });
    return toDomainClubMembership(record);
  }

  async delete(organizationId: string, provider: ErpProviderCode, customerCpf: string): Promise<void> {
    await this.prisma.clubMembership.deleteMany({ where: { organizationId, provider, customerCpf } });
  }

  async deleteExpired(before: Date): Promise<number> {
    const result = await this.prisma.clubMembership.deleteMany({ where: { validUntil: { lt: before } } });
    return result.count;
  }
}
