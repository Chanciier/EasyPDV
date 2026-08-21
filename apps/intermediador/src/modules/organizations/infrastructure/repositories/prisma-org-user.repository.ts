import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service.js";
import { OrgUser } from "../../domain/entities/org-user.entity.js";
import type {
  CreateOrgUserData,
  OrgUserRepositoryPort,
  UpdateOrgUserData,
} from "../../application/ports/org-user-repository.port.js";
import { toDomainOrgUser } from "../mappers/org-user.mapper.js";

@Injectable()
export class PrismaOrgUserRepository implements OrgUserRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<OrgUser | null> {
    const record = await this.prisma.orgUser.findUnique({ where: { id } });
    return record ? toDomainOrgUser(record) : null;
  }

  async findByOrganizationAndEmail(organizationId: string, email: string): Promise<OrgUser | null> {
    const record = await this.prisma.orgUser.findUnique({
      where: { organizationId_email: { organizationId, email } },
    });
    return record ? toDomainOrgUser(record) : null;
  }

  async findAllByOrganization(organizationId: string): Promise<OrgUser[]> {
    const records = await this.prisma.orgUser.findMany({
      where: { organizationId },
      orderBy: { employeeCode: "asc" },
    });
    return records.map(toDomainOrgUser);
  }

  async create(data: CreateOrgUserData): Promise<OrgUser> {
    const record = await this.prisma.orgUser.create({ data });
    return toDomainOrgUser(record);
  }

  async update(id: string, data: UpdateOrgUserData): Promise<OrgUser> {
    const record = await this.prisma.orgUser.update({ where: { id }, data });
    return toDomainOrgUser(record);
  }

  async getMaxEmployeeCode(organizationId: string): Promise<number> {
    const result = await this.prisma.orgUser.aggregate({
      where: { organizationId },
      _max: { employeeCode: true },
    });
    return result._max.employeeCode ?? 0;
  }
}
