import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { SyncGatewayEntry, SyncGatewayPort } from "../../application/ports/sync-gateway.port.js";

@Injectable()
export class HttpSyncGateway implements SyncGatewayPort {
  private readonly baseUrl: string;

  constructor(configService: ConfigService) {
    this.baseUrl = configService.get<string>("INTERMEDIADOR_URL") ?? "http://127.0.0.1:4002";
  }

  async send(entry: SyncGatewayEntry): Promise<void> {
    const response = await fetch(`${this.baseUrl}/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
    if (!response.ok) {
      throw new Error(`Intermediador respondeu ${response.status} para ${entry.entityType}:${entry.entityId}`);
    }
  }
}
