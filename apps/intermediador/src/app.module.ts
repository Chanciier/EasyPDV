import { Module } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";
import { HealthModule } from "./modules/health/health.module.js";

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        transport: process.env.NODE_ENV !== "production" ? { target: "pino-pretty" } : undefined,
      },
    }),
    HealthModule,
    // Sprint 6+: ErpIntegrationModule (Adapter Bling, ErpSyncMapping, SyncJob, fila BullMQ)
    // Ver Claude/Projetos/EasyPDV/Modelo de Domínio.md no cofre Obsidian.
  ],
})
export class AppModule {}
