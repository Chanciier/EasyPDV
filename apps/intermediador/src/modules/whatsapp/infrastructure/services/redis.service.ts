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
    // Achado M6 da auditoria de segurança (2026-09-14): fallback silencioso
    // pra um Redis local sem senha, se REDIS_URL sumir do ambiente — mesma
    // pegadinha que JWT_SECRET já evita com getOrThrow em outros módulos.
    // Isso guarda as credenciais de sessão do WhatsApp (Baileys); é melhor
    // o boot falhar ruidosamente do que tentar um endpoint errado em
    // silêncio.
    const url = this.configService.getOrThrow<string>("REDIS_URL");
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
