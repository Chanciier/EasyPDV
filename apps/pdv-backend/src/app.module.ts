import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { LoggerModule } from "nestjs-pino";
import { DomainExceptionFilter } from "./common/filters/domain-exception.filter.js";
import { maskSensitiveUrl } from "./common/mask-sensitive-url.js";
import { AuditModule } from "./modules/audit/audit.module.js";
import { CatalogModule } from "./modules/catalog/catalog.module.js";
import { ClubModule } from "./modules/club/club.module.js";
import { CustomersModule } from "./modules/customers/customers.module.js";
import { FiscalModule } from "./modules/fiscal/fiscal.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { IdentityModule } from "./modules/identity/identity.module.js";
import { InventoryModule } from "./modules/inventory/inventory.module.js";
import { ProvisioningModule } from "./modules/provisioning/provisioning.module.js";
import { ReportingModule } from "./modules/reporting/reporting.module.js";
import { RealtimeModule } from "./modules/realtime/realtime.module.js";
import { SalesModule } from "./modules/sales/sales.module.js";
import { StoreCreditModule } from "./modules/store-credit/store-credit.module.js";
import { SyncModule } from "./modules/sync/sync.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    // SEG-01 + PERF-13 (2026-10-22): o serializer padrão do pino-http gravava
    // todos os headers (Bearer do operador) e a URL crua (CPF no path) de
    // toda requisição. Serializer enxuto (sem headers, URL mascarada), redact
    // como cinto extra, e sem linha de log para o polling de /health e
    // /sync/status. `responseTime` continua no log.
    LoggerModule.forRoot({
      pinoHttp: {
        transport: process.env.NODE_ENV !== "production" ? { target: "pino-pretty" } : undefined,
        autoLogging: {
          ignore: (req) => /^\/(health|sync\/status)(\/|\?|$)/.test((req as { originalUrl?: string }).originalUrl ?? req.url ?? ""),
        },
        redact: {
          paths: [
            "req.headers.authorization",
            'req.headers["x-terminal-api-key"]',
            'req.headers["x-ecommerce-api-key"]',
            "req.headers.cookie",
            'res.headers["set-cookie"]',
          ],
          censor: "[redacted]",
        },
        serializers: {
          req: (req: { id?: unknown; method?: string; url?: string }) => ({
            id: req.id,
            method: req.method,
            url: maskSensitiveUrl(req.url),
          }),
          res: (res: { statusCode?: number }) => ({ statusCode: res.statusCode }),
        },
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
    ClubModule,
    StoreCreditModule,
    // Ver docs/MODULES.md para a lista completa de módulos.
  ],
  providers: [{ provide: APP_FILTER, useClass: DomainExceptionFilter }],
})
export class AppModule {}
