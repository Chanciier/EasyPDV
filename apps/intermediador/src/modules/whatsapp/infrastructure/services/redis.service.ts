import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

/**
 * Cliente Redis genérico (Fase 4, 2026-09-14) — só existe pra sessão do
 * WhatsApp (credenciais/chaves do Baileys, ver BaileysConnectionManager).
 * `BullModule` já tem sua própria conexão Redis interna, mas não expõe um
 * client de uso geral — não dá pra reaproveitar aquela conexão aqui.
 * Mesmo padrão do `RedisService` do Saldão da Reversa (`get/set/del/keys`),
 * reduzido ao que este módulo precisa de verdade.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const url = this.configService.get<string>("REDIS_URL") ?? "redis://127.0.0.1:6379";
    this.client = new Redis(url);
    this.client.on("error", (err: Error) => this.logger.error(`Redis error: ${err.message}`));
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string): Promise<void> {
    await this.client.set(key, value);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }

  async delPattern(pattern: string): Promise<void> {
    const keys = await this.client.keys(pattern);
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }
}
