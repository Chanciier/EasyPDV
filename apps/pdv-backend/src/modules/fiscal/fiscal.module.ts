import { Module } from "@nestjs/common";
import { ProvisioningModule } from "../provisioning/provisioning.module.js";
import { FiscalController } from "./infrastructure/controllers/fiscal.controller.js";
import { HttpFiscalGateway } from "./infrastructure/gateways/http-fiscal.gateway.js";
import { PrismaFiscalDocumentRepository } from "./infrastructure/repositories/prisma-fiscal-document.repository.js";
import { FISCAL_DOCUMENT_REPOSITORY } from "./application/ports/fiscal-document-repository.port.js";
import { FISCAL_GATEWAY } from "./application/ports/fiscal-gateway.port.js";
import { GetFiscalStatusUseCase } from "./application/use-cases/get-fiscal-status.use-case.js";
import { IssueFiscalReceiptManuallyUseCase } from "./application/use-cases/issue-fiscal-receipt-manually.use-case.js";

@Module({
  imports: [ProvisioningModule],
  controllers: [FiscalController],
  providers: [
    GetFiscalStatusUseCase,
    IssueFiscalReceiptManuallyUseCase,
    { provide: FISCAL_DOCUMENT_REPOSITORY, useClass: PrismaFiscalDocumentRepository },
    { provide: FISCAL_GATEWAY, useClass: HttpFiscalGateway },
  ],
})
export class FiscalModule {}
