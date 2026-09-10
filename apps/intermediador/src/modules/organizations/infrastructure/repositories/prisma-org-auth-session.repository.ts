import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service.js";
import type {
  CreateOrgAuthSessionData,
  OrgAuthSessionRecord,
  OrgAuthSessionRepositoryPort,
} from "../../application/ports/org-auth-session-repository.port.js";

/** Espelha PrismaAuthSessionRepository do pdv-backend. */
@Injectable()
export class PrismaOrgAuthSessionRepository implements OrgAuthSessionRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateOrgAuthSessionData): Promise<OrgAuthSessionRecord> {
    return this.prisma.orgAuthSession.create({ data });
  }

  async findById(id: string): Promise<OrgAuthSessionRecord | null> {
    return this.prisma.orgAuthSession.findUnique({ where: { id } });
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.orgAuthSession.update({ where: { id }, data: { revokedAt: new Date() } });
  }
}
