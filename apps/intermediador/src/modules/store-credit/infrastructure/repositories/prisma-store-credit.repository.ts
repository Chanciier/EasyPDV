import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service.js";
import type {
  CreateStoreCreditGrantData,
  RedeemStoreCreditData,
  StoreCreditGrantResult,
  StoreCreditRepositoryPort,
} from "../../application/ports/store-credit-repository.port.js";

@Injectable()
export class PrismaStoreCreditRepository implements StoreCreditRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async getBalance(organizationId: string, customerCpf: string): Promise<number> {
    const record = await this.prisma.storeCreditBalance.findUnique({
      where: { organizationId_customerCpf: { organizationId, customerCpf } },
    });
    return record?.balance ?? 0;
  }

  async grant(data: CreateStoreCreditGrantData): Promise<StoreCreditGrantResult> {
    return this.prisma.$transaction(async (tx) => {
      const grant = await tx.storeCreditGrant.create({
        data: {
          organizationId: data.organizationId,
          customerCpf: data.customerCpf,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          storeId: data.storeId,
          terminalId: data.terminalId,
          totalAmount: data.totalAmount,
          items: { create: data.items },
        },
      });

      const balanceRecord = await tx.storeCreditBalance.upsert({
        where: { organizationId_customerCpf: { organizationId: data.organizationId, customerCpf: data.customerCpf } },
        create: { organizationId: data.organizationId, customerCpf: data.customerCpf, balance: data.totalAmount },
        update: { balance: { increment: data.totalAmount } },
      });

      return { grantId: grant.id, totalAmount: data.totalAmount, balance: balanceRecord.balance, items: data.items };
    });
  }

  /**
   * Decremento atômico condicional — mesma técnica do débito de estoque
   * (`{decrement: n}` com guarda no `WHERE`). `updateMany` com `balance:
   * {gte: amount}` só afeta a linha se ainda houver saldo suficiente NO
   * MOMENTO da transação; `count === 0` cobre tanto "saldo insuficiente"
   * quanto "CPF nunca teve crédito nenhum" (nenhuma linha existe pra
   * atualizar) — os dois casos são "não pode resgatar", tratados iguais.
   */
  async redeem(data: RedeemStoreCreditData): Promise<{ balance: number } | null> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.storeCreditBalance.updateMany({
        where: { organizationId: data.organizationId, customerCpf: data.customerCpf, balance: { gte: data.amount } },
        data: { balance: { decrement: data.amount } },
      });
      if (updated.count === 0) {
        return null;
      }

      await tx.storeCreditRedemption.create({
        data: {
          organizationId: data.organizationId,
          customerCpf: data.customerCpf,
          amount: data.amount,
          storeId: data.storeId,
          terminalId: data.terminalId,
          saleReference: data.saleReference,
        },
      });

      const balanceRecord = await tx.storeCreditBalance.findUniqueOrThrow({
        where: { organizationId_customerCpf: { organizationId: data.organizationId, customerCpf: data.customerCpf } },
      });
      return { balance: balanceRecord.balance };
    });
  }
}
