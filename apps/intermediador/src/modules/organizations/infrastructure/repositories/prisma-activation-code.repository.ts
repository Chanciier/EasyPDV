import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service.js";
import type { ActivationCode } from "../../domain/entities/activation-code.entity.js";
import type {
  ActivationCodeRepositoryPort,
  CreateActivationCodeData,
} from "../../application/ports/activation-code-repository.port.js";
import { toDomainActivationCode } from "../mappers/organizations.mapper.js";

@Injectable()
export class PrismaActivationCodeRepository implements ActivationCodeRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateActivationCodeData): Promise<ActivationCode> {
    const record = await this.prisma.activationCode.create({ data });
    return toDomainActivationCode(record);
  }

  async findByCode(code: string): Promise<ActivationCode | null> {
    const record = await this.prisma.activationCode.findUnique({ where: { code } });
    return record ? toDomainActivationCode(record) : null;
  }

  async markUsed(id: string): Promise<boolean> {
    const result = await this.prisma.activationCode.updateMany({
      where: { id, usedAt: null },
      data: { usedAt: new Date() },
    });
    return result.count > 0;
  }
}
