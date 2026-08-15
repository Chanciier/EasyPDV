import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../identity/infrastructure/guards/jwt-auth.guard.js";
import { GetFiscalStatusUseCase } from "../../application/use-cases/get-fiscal-status.use-case.js";

@Controller("sales/:saleId/fiscal")
@UseGuards(JwtAuthGuard)
export class FiscalController {
  constructor(private readonly getFiscalStatusUseCase: GetFiscalStatusUseCase) {}

  @Get()
  get(@Param("saleId") saleId: string) {
    return this.getFiscalStatusUseCase.execute(saleId);
  }
}
