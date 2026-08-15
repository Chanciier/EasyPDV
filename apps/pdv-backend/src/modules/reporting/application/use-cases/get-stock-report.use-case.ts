import { Inject, Injectable } from "@nestjs/common";
import type { StockReportEntry } from "@easypdv/shared-types";
import { REPORTING_REPOSITORY, type ReportingRepositoryPort } from "../ports/reporting-repository.port.js";

@Injectable()
export class GetStockReportUseCase {
  constructor(@Inject(REPORTING_REPOSITORY) private readonly reportingRepository: ReportingRepositoryPort) {}

  execute(warehouseId?: string): Promise<StockReportEntry[]> {
    return this.reportingRepository.getStockReport(warehouseId);
  }
}
