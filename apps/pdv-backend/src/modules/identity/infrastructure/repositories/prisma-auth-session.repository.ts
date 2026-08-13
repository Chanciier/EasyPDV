import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service.js";
import type {
  AuthSessionRecord,
  AuthSessionRepositoryPort,
  CreateAuthSessionData,
} from "../../application/ports/auth-session-repository.port.js";

@Injectable()
export class PrismaAuthSessionRepository implements AuthSessionRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateAuthSessionData): Promise<AuthSessionRecord> {
    return this.prisma.authSession.create({ data });
  }

  async findById(id: string): Promise<AuthSessionRecord | null> {
    return this.prisma.authSession.findUnique({ where: { id } });
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.authSession.update({ where: { id }, data: { revokedAt: new Date() } });
  }
}
