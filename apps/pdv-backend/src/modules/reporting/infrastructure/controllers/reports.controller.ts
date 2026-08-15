import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../identity/infrastructure/guards/jwt-auth.guard.js";
import { RolesGuard } from "../../../identity/infrastructure/guards/roles.guard.js";
import { Roles } from "../../../identity/infrastructure/decorators/roles.decorator.js";
import { GetSalesReportUseCase } from "../../application/use-cases/get-sales-report.use-case.js";
import { GetCashSessionsReportUseCase } from "../../application/use-cases/get-cash-sessions-report.use-case.js";
import { GetStockReportUseCase } from "../../application/use-cases/get-stock-report.use-case.js";
import { GetDashboardReportUseCase } from "../../application/use-cases/get-dashboard-report.use-case.js";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function resolveRange(from?: string, to?: string): { from: Date; to: Date } {
  const toDate = to ? new Date(to) : new Date();
  const fromDate = from ? new Date(from) : new Date(toDate.getTime() - THIRTY_DAYS_MS);
  return { from: fromDate, to: toDate };
}

/**
 * `dashboard` fica sem `@Roles` (qualquer autenticado vê) — é o resumo do
 * dia que já aparecia pro operador na tela de Histórico, só que agora
 * agregado no banco em vez de somado client-side (Sprint 13). Os demais
 * (análise histórica cross-período) são visão gerencial.
 */
@Controller("reports")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(
    private readonly getSalesReportUseCase: GetSalesReportUseCase,
    private readonly getCashSessionsReportUseCase: GetCashSessionsReportUseCase,
    private readonly getStockReportUseCase: GetStockReportUseCase,
    private readonly getDashboardReportUseCase: GetDashboardReportUseCase,
  ) {}

  @Get("sales")
  @Roles("administrador", "gerente", "proprietario")
  sales(@Query("from") from?: string, @Query("to") to?: string) {
    const range = resolveRange(from, to);
    return this.getSalesReportUseCase.execute(range.from, range.to);
  }

  @Get("cash-sessions")
  @Roles("administrador", "gerente", "proprietario")
  cashSessions(@Query("from") from?: string, @Query("to") to?: string) {
    const range = resolveRange(from, to);
    return this.getCashSessionsReportUseCase.execute(range.from, range.to);
  }

  @Get("stock")
  @Roles("administrador", "gerente", "proprietario")
  stock(@Query("warehouseId") warehouseId?: string) {
    return this.getStockReportUseCase.execute(warehouseId);
  }

  @Get("dashboard")
  dashboard() {
    return this.getDashboardReportUseCase.execute();
  }
}
