import { Inject, Injectable } from "@nestjs/common";
import type { CashSession } from "@easypdv/shared-types";
import { REPORTING_REPOSITORY, type ReportingRepositoryPort } from "../ports/reporting-repository.port.js";

@Injectable()
export class GetCashSessionsReportUseCase {
  constructor(@Inject(REPORTING_REPOSITORY) private readonly reportingRepository: ReportingRepositoryPort) {}

  execute(from: Date, to: Date): Promise<CashSession[]> {
    return this.reportingRepository.getCashSessionsReport(from, to);
  }
}
