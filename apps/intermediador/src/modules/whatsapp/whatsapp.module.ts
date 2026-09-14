import { Module } from "@nestjs/common";
import { AdminWhatsappController } from "./infrastructure/controllers/admin-whatsapp.controller.js";
import { RedisService } from "./infrastructure/services/redis.service.js";
import { BaileysConnectionManager } from "./infrastructure/services/baileys-connection-manager.service.js";
import { WhatsappProvider } from "./whatsapp.provider.js";

/**
 * Canal de WhatsApp (Fase 4 do lembrete de renovação, 2026-09-14) — Baileys
 * não-oficial, aceito conscientemente pelo usuário ("por enquanto", ver
 * "API de WhatsApp (Baileys).md" no cofre Obsidian pra avaliação completa
 * de risco). `WhatsappProvider` exportado pra `club-reminders` plugar no
 * motor da Fase 3; `BaileysConnectionManager`/`RedisService` ficam
 * internos, ninguém fora deste módulo deveria depender deles direto.
 */
@Module({
  controllers: [AdminWhatsappController],
  providers: [RedisService, BaileysConnectionManager, WhatsappProvider],
  exports: [WhatsappProvider],
})
export class WhatsappModule {}
