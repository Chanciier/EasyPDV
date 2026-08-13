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
    // Sprint 1+: IdentityModule, CatalogModule, InventoryModule, CustomersModule, SalesModule, FiscalModule
    // Ver Claude/Projetos/EasyPDV/Modelo de Domínio.md no cofre Obsidian para a lista completa de módulos.
  ],
})
export class AppModule {}
