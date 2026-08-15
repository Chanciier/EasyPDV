import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service.js";
import type { Organization } from "../../domain/entities/organization.entity.js";
import type {
  CreateOrganizationData,
  OrganizationRepositoryPort,
} from "../../application/ports/organization-repository.port.js";
import { toDomainOrganization } from "../mappers/organizations.mapper.js";

@Injectable()
export class PrismaOrganizationRepository implements OrganizationRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateOrganizationData): Promise<Organization> {
    const record = await this.prisma.organization.create({ data });
    return toDomainOrganization(record);
  }

  async findById(id: string): Promise<Organization | null> {
    const record = await this.prisma.organization.findUnique({ where: { id } });
    return record ? toDomainOrganization(record) : null;
  }
}
