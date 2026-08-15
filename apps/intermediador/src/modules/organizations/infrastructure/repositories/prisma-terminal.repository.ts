import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service.js";
import type { Terminal } from "../../domain/entities/terminal.entity.js";
import type { CreateTerminalData, TerminalRepositoryPort } from "../../application/ports/terminal-repository.port.js";
import { toDomainTerminal } from "../mappers/organizations.mapper.js";

@Injectable()
export class PrismaTerminalRepository implements TerminalRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateTerminalData): Promise<Terminal> {
    const record = await this.prisma.terminal.create({ data });
    return toDomainTerminal(record);
  }

  async findByApiKeyHash(apiKeyHash: string): Promise<Terminal | null> {
    const record = await this.prisma.terminal.findUnique({ where: { apiKeyHash } });
    return record ? toDomainTerminal(record) : null;
  }

  async touchLastSeen(id: string): Promise<void> {
    await this.prisma.terminal.update({ where: { id }, data: { lastSeenAt: new Date() } });
  }
}
