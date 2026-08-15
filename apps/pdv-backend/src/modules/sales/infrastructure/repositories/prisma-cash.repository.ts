import { Injectable } from "@nestjs/common";
import type { CashRegister } from "@easypdv/shared-types";
import { PrismaService } from "../../../../prisma/prisma.service.js";
import { CashSession } from "../../domain/entities/cash-session.entity.js";
import type {
  CashMovementRecord,
  CashRepositoryPort,
  OpenCashSessionData,
  RegisterCashMovementData,
} from "../../application/ports/cash-repository.port.js";
import { toDomainCashSession } from "../mappers/sales.mapper.js";

@Injectable()
export class PrismaCashRepository implements CashRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  findRegisterById(id: string): Promise<CashRegister | null> {
    return this.prisma.cashRegister.findUnique({ where: { id } });
  }

  listRegisters(): Promise<CashRegister[]> {
    return this.prisma.cashRegister.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  }

  createRegister(name: string): Promise<CashRegister> {
    return this.prisma.cashRegister.create({ data: { name } });
  }

  async findOpenSessionByRegister(cashRegisterId: string): Promise<CashSession | null> {
    const record = await this.prisma.cashSession.findFirst({ where: { cashRegisterId, status: "open" } });
    return record ? toDomainCashSession(record) : null;
  }

  async findOpenSessionByOperator(operatorUserId: string): Promise<CashSession | null> {
    const record = await this.prisma.cashSession.findFirst({ where: { operatorUserId, status: "open" } });
    return record ? toDomainCashSession(record) : null;
  }

  async findAnyOpenSession(): Promise<CashSession | null> {
    const record = await this.prisma.cashSession.findFirst({ where: { status: "open" } });
    return record ? toDomainCashSession(record) : null;
  }

  async findSessionById(id: string): Promise<CashSession | null> {
    const record = await this.prisma.cashSession.findUnique({ where: { id } });
    return record ? toDomainCashSession(record) : null;
  }

  async openSession(data: OpenCashSessionData): Promise<CashSession> {
    const record = await this.prisma.cashSession.create({
      data: {
        cashRegisterId: data.cashRegisterId,
        operatorUserId: data.operatorUserId,
        openingAmount: data.openingAmount,
        terminalId: data.terminalId,
      },
    });
    return toDomainCashSession(record);
  }

  async closeSession(id: string, closingAmount: number, expectedAmount: number): Promise<CashSession> {
    const record = await this.prisma.cashSession.update({
      where: { id },
      data: { closingAmount, expectedAmount, status: "closed", closedAt: new Date() },
    });
    return toDomainCashSession(record);
  }

  registerMovement(data: RegisterCashMovementData): Promise<CashMovementRecord> {
    return this.prisma.cashMovement.create({
      data: {
        cashSessionId: data.cashSessionId,
        type: data.type,
        amount: data.amount,
        reason: data.reason,
        authorizedByUserId: data.authorizedByUserId,
      },
    });
  }

  listMovements(cashSessionId: string): Promise<CashMovementRecord[]> {
    return this.prisma.cashMovement.findMany({
      where: { cashSessionId },
      orderBy: { createdAt: "desc" },
    });
  }

  async sumMovements(cashSessionId: string): Promise<{ sangria: number; suprimento: number; ajuste: number }> {
    const movements = await this.prisma.cashMovement.findMany({ where: { cashSessionId } });
    return movements.reduce(
      (acc, m) => {
        acc[m.type] += m.amount;
        return acc;
      },
      { sangria: 0, suprimento: 0, ajuste: 0 },
    );
  }
}
