import { Inject, Injectable } from "@nestjs/common";
import type { SalesReportEntry } from "@easypdv/shared-types";
import { REPORTING_REPOSITORY, type ReportingRepositoryPort } from "../ports/reporting-repository.port.js";

@Injectable()
export class GetSalesReportUseCase {
  constructor(@Inject(REPORTING_REPOSITORY) private readonly reportingRepository: ReportingRepositoryPort) {}

  execute(from: Date, to: Date): Promise<SalesReportEntry[]> {
    return this.reportingRepository.getSalesReport(from, to);
  }
}
