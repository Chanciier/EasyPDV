import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { LoggerModule } from "nestjs-pino";
import { DomainExceptionFilter } from "./common/filters/domain-exception.filter.js";
import { AuditModule } from "./modules/audit/audit.module.js";
import { CatalogModule } from "./modules/catalog/catalog.module.js";
import { CustomersModule } from "./modules/customers/customers.module.js";
import { FiscalModule } from "./modules/fiscal/fiscal.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { IdentityModule } from "./modules/identity/identity.module.js";
import { InventoryModule } from "./modules/inventory/inventory.module.js";
import { ProvisioningModule } from "./modules/provisioning/provisioning.module.js";
import { ReportingModule } from "./modules/reporting/reporting.module.js";
import { RealtimeModule } from "./modules/realtime/realtime.module.js";
import { SalesModule } from "./modules/sales/sales.module.js";
import { SyncModule } from "./modules/sync/sync.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    LoggerModule.forRoot({
      pinoHttp: {
        transport: process.env.NODE_ENV !== "production" ? { target: "pino-pretty" } : undefined,
      },
    }),
    PrismaModule,
    HealthModule,
    IdentityModule,
    CatalogModule,
    InventoryModule,
    SalesModule,
    ProvisioningModule,
    SyncModule,
    FiscalModule,
    AuditModule,
    ReportingModule,
    RealtimeModule,
    CustomersModule,
    // Ver docs/MODULES.md para a lista completa de módulos.
  ],
  providers: [{ provide: APP_FILTER, useClass: DomainExceptionFilter }],
})
export class AppModule {}
