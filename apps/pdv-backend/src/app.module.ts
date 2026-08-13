import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER } from "@nestjs/core";
import { LoggerModule } from "nestjs-pino";
import { DomainExceptionFilter } from "./common/filters/domain-exception.filter.js";
import { CatalogModule } from "./modules/catalog/catalog.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { IdentityModule } from "./modules/identity/identity.module.js";
import { InventoryModule } from "./modules/inventory/inventory.module.js";
import { SalesModule } from "./modules/sales/sales.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
    // Sprint 5+: Payment (dentro de SalesModule) + CustomersModule + FiscalModule
    // Ver docs/MODULES.md para a lista completa de módulos.
  ],
  providers: [{ provide: APP_FILTER, useClass: DomainExceptionFilter }],
})
export class AppModule {}
