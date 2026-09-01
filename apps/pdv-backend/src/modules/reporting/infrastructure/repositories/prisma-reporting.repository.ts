import { Injectable } from "@nestjs/common";
import type { CashSession, DashboardReport, SalesReportEntry, StockReportEntry } from "@easypdv/shared-types";
import { toBrazilDateString } from "@easypdv/shared-validation";
import { PrismaService } from "../../../../prisma/prisma.service.js";
import type { ReportingRepositoryPort } from "../../application/ports/reporting-repository.port.js";

/**
 * Módulo de leitura pura, cross-aggregate de propósito — não passa pelos
 * repositórios de domínio de Sales/Inventory (SaleRepositoryPort etc.),
 * consulta o Prisma direto. Relatório não tem invariante de domínio pra
 * proteger, e forçar tudo pela porta de cada módulo exigiria expor métodos
 * de agregação que só existem pra isso. Ver docs/MODULES.md.
 */
@Injectable()
export class PrismaReportingRepository implements ReportingRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Agrupado por dia em JS, não SQL — SQLite dá pra fazer com strftime, mas
   * evita depender de $queryRaw pra um volume que nunca vai justificar.
   * `toBrazilDateString` (não `.toISOString().slice(0,10)`, sempre UTC) —
   * mesma classe de bug encontrada em produção (2026-09-02) na geração de
   * NFC-e: sem isso, uma venda confirmada à noite (~21h-23h59 BRT) cairia no
   * dia seguinte do relatório.
   */
  async getSalesReport(from: Date, to: Date): Promise<SalesReportEntry[]> {
    const sales = await this.prisma.sale.findMany({
      where: { status: "confirmed", confirmedAt: { gte: from, lte: to } },
      select: { confirmedAt: true, totalAmount: true },
    });

    const byDay = new Map<string, { salesCount: number; totalAmount: number }>();
    for (const sale of sales) {
      const day = toBrazilDateString(sale.confirmedAt!);
      const entry = byDay.get(day) ?? { salesCount: 0, totalAmount: 0 };
      entry.salesCount += 1;
      entry.totalAmount += sale.totalAmount;
      byDay.set(day, entry);
    }

    return Array.from(byDay.entries())
      .map(([period, values]) => ({ period, ...values }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }

  async getCashSessionsReport(from: Date, to: Date): Promise<CashSession[]> {
    const sessions = await this.prisma.cashSession.findMany({
      where: { status: { in: ["closed", "reconciled"] }, closedAt: { gte: from, lte: to } },
      orderBy: { closedAt: "desc" },
    });
    return sessions.map((session) => ({
      id: session.id,
      cashRegisterId: session.cashRegisterId,
      operatorUserId: session.operatorUserId,
      openedAt: session.openedAt.toISOString(),
      closedAt: session.closedAt ? session.closedAt.toISOString() : null,
      openingAmount: session.openingAmount,
      closingAmount: session.closingAmount,
      expectedAmount: session.expectedAmount,
      status: session.status,
    }));
  }

  async getStockReport(warehouseId?: string): Promise<StockReportEntry[]> {
    const items = await this.prisma.stockItem.findMany({
      where: warehouseId ? { warehouseId } : undefined,
    });
    return items.map((item) => ({
      warehouseId: item.warehouseId,
      productId: item.productId,
      quantity: item.quantity,
    }));
  }

  /**
   * Sem cap de 100 registros (diferente de GET /sales) — corrige o bug real
   * do Histórico, que hoje soma client-side uma lista já paginada e mostra
   * um total errado a partir da 101ª venda do dia (Sprint 13).
   */
  async getDashboardReport(): Promise<DashboardReport> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [salesAggregate, openCashSessionsCount] = await Promise.all([
      this.prisma.sale.aggregate({
        where: { status: "confirmed", confirmedAt: { gte: startOfDay } },
        _count: true,
        _sum: { totalAmount: true },
      }),
      this.prisma.cashSession.count({ where: { status: "open" } }),
    ]);

    const todaySalesCount = salesAggregate._count;
    const todaySalesTotal = salesAggregate._sum.totalAmount ?? 0;

    return {
      todaySalesCount,
      todaySalesTotal,
      averageTicket: todaySalesCount > 0 ? todaySalesTotal / todaySalesCount : 0,
      openCashSessionsCount,
    };
  }
}
