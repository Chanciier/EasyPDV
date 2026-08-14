import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER } from "@nestjs/core";
import { LoggerModule } from "nestjs-pino";
import { DomainExceptionFilter } from "./common/filters/domain-exception.filter.js";
import { ErpIntegrationModule } from "./modules/erp-integration/erp-integration.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { SyncModule } from "./modules/sync/sync.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport: process.env.NODE_ENV !== "production" ? { target: "pino-pretty" } : undefined,
      },
    }),
    BullModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        connection: { url: config.get<string>("REDIS_URL") ?? "redis://127.0.0.1:6379" },
      }),
      inject: [ConfigService],
    }),
    PrismaModule,
    HealthModule,
    ErpIntegrationModule,
    SyncModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: DomainExceptionFilter }],
})
export class AppModule {}
