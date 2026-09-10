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

      // Upsert primeiro (garante que a linha existe), incremento arredondado
      // depois — ver comentário completo em `redeem()` sobre o motivo do
      // ROUND explícito dentro do UPDATE, não só no valor de retorno.
      await tx.storeCreditBalance.upsert({
        where: { organizationId_customerCpf: { organizationId: data.organizationId, customerCpf: data.customerCpf } },
        create: { organizationId: data.organizationId, customerCpf: data.customerCpf, balance: 0 },
        update: {},
      });
      await tx.$executeRaw`
        UPDATE "StoreCreditBalance"
        SET balance = ROUND((balance + ${data.totalAmount}::float8)::numeric, 2)::float8,
            "updatedAt" = now()
        WHERE "organizationId" = ${data.organizationId} AND "customerCpf" = ${data.customerCpf}
      `;
      const balanceRecord = await tx.storeCreditBalance.findUniqueOrThrow({
        where: { organizationId_customerCpf: { organizationId: data.organizationId, customerCpf: data.customerCpf } },
      });

      return { grantId: grant.id, totalAmount: data.totalAmount, balance: balanceRecord.balance, items: data.items };
    });
  }

  /**
   * Decremento atômico condicional — mesma técnica do débito de estoque
   * (`{decrement: n}` com guarda no `WHERE`), com um detalhe a mais:
   * **arredondamento explícito (`ROUND(..., 2)`) dentro do próprio UPDATE**,
   * não só no valor de retorno. Achado testando de verdade (2026-09-10):
   * dois grants de 53.3 e 24.9 resultavam em `78.19999999999999` armazenado
   * (soma em ponto flutuante, Postgres `double precision` tem o mesmo
   * problema que JS) — sem o arredondamento AQUI, essa mesma comparação
   * (`balance >= amount`) rejeitaria um resgate de exatamente 78.20,
   * negando um saldo que era válido pra qualquer humano. Mesma classe do
   * bug já corrigido em `Sale.isFullyPaid` (commit `de5b8fd`) — lá o fix
   * foi arredondar o valor COMPARADO; aqui precisa arredondar o valor
   * ARMAZENADO, porque a comparação roda dentro do próprio `WHERE` da
   * atualização atômica, não em código de aplicação depois de ler o valor.
   *
   * `count === 0` cobre tanto "saldo insuficiente" quanto "CPF nunca teve
   * crédito nenhum" (nenhuma linha existe pra atualizar) — os dois casos
   * são "não pode resgatar", tratados iguais.
   */
  async redeem(data: RedeemStoreCreditData): Promise<{ balance: number } | null> {
    return this.prisma.$transaction(async (tx) => {
      /**
       * Idempotência de retry (Fase 3, 2026-09-10) — ConfirmSaleUseCase (pdv-backend)
       * chama este redeem ANTES de confirmar a venda localmente (mesma lógica de
       * "o que é mais difícil de desfazer roda primeiro" já usada em
       * GrantStoreCreditUseCase). Se o redeem for bem-sucedido aqui mas a
       * confirmação local falhar depois (rede, ou qualquer erro), a venda continua
       * "draft" e o operador clica "Confirmar" de novo — sem essa checagem,
       * debitaria o saldo do cliente DUAS vezes pela mesma venda. Mesma classe do
       * bug real de pagamento duplicado em retry já documentado em
       * register-payment.use-case.ts (pdv-backend); fechado aqui, na origem do
       * saldo, não só confiando em lógica do lado do terminal.
       */
      if (data.saleReference) {
        const existing = await tx.storeCreditRedemption.findFirst({
          where: { organizationId: data.organizationId, saleReference: data.saleReference },
        });
        if (existing) {
          const current = await tx.storeCreditBalance.findUnique({
            where: { organizationId_customerCpf: { organizationId: data.organizationId, customerCpf: data.customerCpf } },
          });
          return { balance: current?.balance ?? 0 };
        }
      }

      const affected = await tx.$executeRaw`
        UPDATE "StoreCreditBalance"
        SET balance = ROUND((balance - ${data.amount}::float8)::numeric, 2)::float8,
            "updatedAt" = now()
        WHERE "organizationId" = ${data.organizationId}
          AND "customerCpf" = ${data.customerCpf}
          AND balance >= ${data.amount}
      `;
      if (affected === 0) {
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
