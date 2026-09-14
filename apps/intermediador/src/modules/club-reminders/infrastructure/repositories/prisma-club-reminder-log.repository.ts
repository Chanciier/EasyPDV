import { Injectable } from "@nestjs/common";
import { Prisma } from "../../../../generated/prisma/index.js";
import { PrismaService } from "../../../../prisma/prisma.service.js";
import type { ClubReminderLogRepositoryPort } from "../../application/ports/club-reminder-log-repository.port.js";

@Injectable()
export class PrismaClubReminderLogRepository implements ClubReminderLogRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async exists(organizationId: string, customerCpf: string, daysBeforeExpiry: number, validUntil: Date): Promise<boolean> {
    const record = await this.prisma.clubReminderLog.findUnique({
      where: {
        organizationId_customerCpf_daysBeforeExpiry_validUntil: { organizationId, customerCpf, daysBeforeExpiry, validUntil },
      },
    });
    return record !== null;
  }

  async record(organizationId: string, customerCpf: string, daysBeforeExpiry: number, validUntil: Date): Promise<boolean> {
    try {
      await this.prisma.clubReminderLog.create({ data: { organizationId, customerCpf, daysBeforeExpiry, validUntil } });
      return true;
    } catch (error) {
      // Mesma constraint única checada em `exists()` — pode bater aqui numa
      // corrida (sweep + reprocessamento de job quase simultâneos). `false`
      // é o resultado correto, não um erro: já foi gravado, é duplicata.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return false;
      }
      throw error;
    }
  }
}
