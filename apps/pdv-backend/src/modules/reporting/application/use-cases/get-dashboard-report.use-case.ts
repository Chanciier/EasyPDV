import { Inject, Injectable } from "@nestjs/common";
import type { DashboardReport } from "@easypdv/shared-types";
import { REPORTING_REPOSITORY, type ReportingRepositoryPort } from "../ports/reporting-repository.port.js";

@Injectable()
export class GetDashboardReportUseCase {
  constructor(@Inject(REPORTING_REPOSITORY) private readonly reportingRepository: ReportingRepositoryPort) {}

  execute(): Promise<DashboardReport> {
    return this.reportingRepository.getDashboardReport();
  }
}
