import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../identity/infrastructure/guards/jwt-auth.guard.js";
import { GetFiscalStatusUseCase } from "../../application/use-cases/get-fiscal-status.use-case.js";
import { IssueFiscalReceiptManuallyUseCase } from "../../application/use-cases/issue-fiscal-receipt-manually.use-case.js";

@Controller("sales/:saleId/fiscal")
@UseGuards(JwtAuthGuard)
export class FiscalController {
  constructor(
    private readonly getFiscalStatusUseCase: GetFiscalStatusUseCase,
    private readonly issueFiscalReceiptManuallyUseCase: IssueFiscalReceiptManuallyUseCase,
  ) {}

  @Get()
  get(@Param("saleId") saleId: string) {
    return this.getFiscalStatusUseCase.execute(saleId);
  }

  @Post("issue")
  issue(@Param("saleId") saleId: string) {
    return this.issueFiscalReceiptManuallyUseCase.execute(saleId);
  }
}
