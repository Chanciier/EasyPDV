import { Module } from "@nestjs/common";
import { ReportsController } from "./infrastructure/controllers/reports.controller.js";
import { PrismaReportingRepository } from "./infrastructure/repositories/prisma-reporting.repository.js";
import { REPORTING_REPOSITORY } from "./application/ports/reporting-repository.port.js";
import { GetSalesReportUseCase } from "./application/use-cases/get-sales-report.use-case.js";
import { GetCashSessionsReportUseCase } from "./application/use-cases/get-cash-sessions-report.use-case.js";
import { GetStockReportUseCase } from "./application/use-cases/get-stock-report.use-case.js";
import { GetDashboardReportUseCase } from "./application/use-cases/get-dashboard-report.use-case.js";

@Module({
  controllers: [ReportsController],
  providers: [
    GetSalesReportUseCase,
    GetCashSessionsReportUseCase,
    GetStockReportUseCase,
    GetDashboardReportUseCase,
    { provide: REPORTING_REPOSITORY, useClass: PrismaReportingRepository },
  ],
})
export class ReportingModule {}
