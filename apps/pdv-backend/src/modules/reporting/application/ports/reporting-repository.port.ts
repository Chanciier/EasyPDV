import type { CashSession, DashboardReport, SalesReportEntry, StockReportEntry } from "@easypdv/shared-types";

export interface ReportingRepositoryPort {
  getSalesReport(from: Date, to: Date): Promise<SalesReportEntry[]>;
  getCashSessionsReport(from: Date, to: Date): Promise<CashSession[]>;
  getStockReport(warehouseId?: string): Promise<StockReportEntry[]>;
  getDashboardReport(): Promise<DashboardReport>;
}

export const REPORTING_REPOSITORY = Symbol("REPORTING_REPOSITORY");
