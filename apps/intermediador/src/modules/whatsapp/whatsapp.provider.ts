import { Injectable } from "@nestjs/common";
import { BaileysConnectionManager } from "./infrastructure/services/baileys-connection-manager.service.js";

/**
 * Fachada fininha sobre o Baileys (mesmo padrão do `WhatsappProvider` do
 * Saldão da Reversa) — quem consome (`SendClubReminderUseCase`) depende
 * desta classe, nunca do `BaileysConnectionManager`/`@whiskeysockets/baileys`
 * direto. É o ponto de troca: se o canal mudar um dia (Cloud API oficial,
 * por exemplo), só o INTERIOR desta classe muda.
 */
@Injectable()
export class WhatsappProvider {
  constructor(private readonly connectionManager: BaileysConnectionManager) {}

  isReady(organizationId: string): boolean {
    return this.connectionManager.isReady(organizationId);
  }

  sendMessage(organizationId: string, jid: string, text: string): Promise<string | undefined> {
    return this.connectionManager.sendMessage(organizationId, jid, text);
  }

  getStatus(organizationId: string): Promise<{ connected: boolean; qr: string | null }> {
    return this.connectionManager.getStatus(organizationId);
  }

  logout(organizationId: string): Promise<void> {
    return this.connectionManager.logout(organizationId);
  }
}
