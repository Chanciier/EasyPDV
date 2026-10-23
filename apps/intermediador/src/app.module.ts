import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { LoggerModule } from "nestjs-pino";
import { DomainExceptionFilter } from "./common/filters/domain-exception.filter.js";
import { maskSensitiveUrl } from "./common/mask-sensitive-url.js";
import { ClubModule } from "./modules/club/club.module.js";
import { ClubRemindersModule } from "./modules/club-reminders/club-reminders.module.js";
import { CustomersModule } from "./modules/customers/customers.module.js";
import { EcommerceIntegrationModule } from "./modules/ecommerce-integration/ecommerce-integration.module.js";
import { ErpIntegrationModule } from "./modules/erp-integration/erp-integration.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { OrganizationsModule } from "./modules/organizations/organizations.module.js";
import { StoreCreditModule } from "./modules/store-credit/store-credit.module.js";
import { SyncModule } from "./modules/sync/sync.module.js";
import { WhatsappModule } from "./modules/whatsapp/whatsapp.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    // SEG-01 (2026-10-22): o serializer padrão do pino-http gravava todos os
    // headers (X-Terminal-Api-Key de cada terminal, Bearer do painel,
    // X-Ecommerce-Api-Key) e a URL crua (CPF no path, ?code= do OAuth Bling)
    // de toda requisição nos logs do Railway. Serializer enxuto (sem headers,
    // URL mascarada), redact como cinto extra, e sem linha de log para o
    // healthcheck. `responseTime` continua no log.
    LoggerModule.forRoot({
      pinoHttp: {
        transport: process.env.NODE_ENV !== "production" ? { target: "pino-pretty" } : undefined,
        autoLogging: {
          ignore: (req) => /^\/health(\/|\?|$)/.test((req as { originalUrl?: string }).originalUrl ?? req.url ?? ""),
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
    // Achado M6 da auditoria de segurança (2026-09-14) — getOrThrow em vez de
    // fallback silencioso pra um Redis local sem senha (ver
    // whatsapp/infrastructure/services/redis.service.ts, mesma correção).
    BullModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        connection: { url: config.getOrThrow<string>("REDIS_URL") },
      }),
      inject: [ConfigService],
    }),
    PrismaModule,
    HealthModule,
    OrganizationsModule,
    ErpIntegrationModule,
    ClubModule,
    WhatsappModule,
    ClubRemindersModule,
    StoreCreditModule,
    CustomersModule,
    SyncModule,
    EcommerceIntegrationModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: DomainExceptionFilter }],
})
export class AppModule {}
