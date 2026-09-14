import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import makeWASocket, {
  type AuthenticationCreds,
  type AuthenticationState,
  DisconnectReason,
  type SignalKeyStore,
  initAuthCreds,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import * as QRCode from "qrcode";
import { RedisService } from "./redis.service.js";

const KEY_PREFIX = "wa:k:";
const CREDS_PREFIX = "wa:creds:";
const RECONNECT_BASE_DELAY_MS = 5_000;
const RECONNECT_MAX_DELAY_MS = 300_000; // 5min — evita martelar o servidor do WhatsApp em loop apertado (ver docblock connect()).
/** Sem credenciais salvas nem QR em 30s → sessão presa, limpa e recomeça (mesma lógica do Saldão da Reversa). */
const STALE_CONNECTION_TIMEOUT_MS = 30_000;

interface OrgConnection {
  socket: ReturnType<typeof makeWASocket> | null;
  qrBase64: string | null;
  connected: boolean;
  reconnectTimer: NodeJS.Timeout | null;
  connectTimeoutTimer: NodeJS.Timeout | null;
  reconnectAttempts: number;
}

function serialize(v: unknown): string {
  return JSON.stringify(v, (_k, val) => {
    if (val instanceof Uint8Array || Buffer.isBuffer(val)) {
      return { _t: "buf", d: Buffer.from(val).toString("base64") };
    }
    if (val && typeof val === "object" && (val as { type?: string }).type === "Buffer" && Array.isArray((val as { data?: unknown }).data)) {
      return { _t: "buf", d: Buffer.from((val as { data: number[] }).data).toString("base64") };
    }
    return val;
  });
}

function deserialize<T>(s: string): T {
  return JSON.parse(s, (_k, val) => {
    if (val && typeof val === "object" && (val as { _t?: string })._t === "buf") {
      return Buffer.from((val as { d: string }).d, "base64");
    }
    return val;
  }) as T;
}

/**
 * Uma sessão Baileys por organização (Fase 4, 2026-09-14) — sessão namespaced
 * no Redis desde o início (`wa:creds:<orgId>`, `wa:k:<orgId>:*`), mesmo com
 * só uma organização em uso real hoje (decisão do usuário: "vale fazer
 * certo desde já" — ver "Planejamento - Lembrete de Renovação do Clube.md"
 * no cofre Obsidian). Adaptado de `BaileysService` do Saldão da Reversa
 * (estudado em 2026-09-09, ver "API de WhatsApp (Baileys).md") — lá era uma
 * sessão global única com conexão eager no boot; aqui não dá: conectar
 * TODAS as organizações no boot desperdiçaria sessões WhatsApp pra quem
 * nunca vai usar. Conecta sob demanda (primeira chamada de `getStatus`,
 * feita pela tela de pareamento do painel admin) e só reconecta
 * automaticamente no boot as organizações que JÁ tinham credenciais salvas
 * (sessão pareada sobrevive a um restart do processo sem precisar escanear
 * QR de novo).
 */
@Injectable()
export class BaileysConnectionManager implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BaileysConnectionManager.name);
  private readonly connections = new Map<string, OrgConnection>();

  constructor(private readonly redis: RedisService) {}

  async onModuleInit(): Promise<void> {
    const credsKeys = await this.redis.keys(`${CREDS_PREFIX}*`);
    for (const key of credsKeys) {
      const organizationId = key.slice(CREDS_PREFIX.length);
      this.logger.log(`Retomando sessão de WhatsApp salva pra organização ${organizationId}`);
      await this.connect(organizationId);
    }
  }

  async onModuleDestroy(): Promise<void> {
    for (const conn of this.connections.values()) {
      if (conn.reconnectTimer) clearTimeout(conn.reconnectTimer);
      if (conn.connectTimeoutTimer) clearTimeout(conn.connectTimeoutTimer);
      try {
        await conn.socket?.end(undefined as never);
      } catch {
        // Encerrando o processo — não há o que fazer com uma falha aqui.
      }
    }
  }

  private getOrCreateConnection(organizationId: string): OrgConnection {
    let conn = this.connections.get(organizationId);
    if (!conn) {
      conn = { socket: null, qrBase64: null, connected: false, reconnectTimer: null, connectTimeoutTimer: null, reconnectAttempts: 0 };
      this.connections.set(organizationId, conn);
    }
    return conn;
  }

  private makeKeyStore(organizationId: string): SignalKeyStore {
    const redis = this.redis;
    const prefix = `${KEY_PREFIX}${organizationId}:`;
    return {
      async get(type, ids) {
        const result: Record<string, unknown> = {};
        await Promise.all(
          ids.map(async (id) => {
            const val = await redis.get(`${prefix}${type}:${id}`);
            if (val) result[id] = deserialize(val);
          }),
        );
        return result as never;
      },
      async set(data) {
        await Promise.all(
          Object.entries(data).flatMap(([type, typeData]) =>
            Object.entries(typeData ?? {}).map(async ([id, value]) => {
              const key = `${prefix}${type}:${id}`;
              if (value != null) {
                await redis.set(key, serialize(value));
              } else {
                await redis.del(key);
              }
            }),
          ),
        );
      },
    };
  }

  private async loadState(organizationId: string): Promise<{ state: AuthenticationState; saveCreds: (c: AuthenticationCreds) => Promise<void> }> {
    const raw = await this.redis.get(`${CREDS_PREFIX}${organizationId}`);
    const creds: AuthenticationCreds = raw ? deserialize(raw) : initAuthCreds();
    const keys = this.makeKeyStore(organizationId);
    const saveCreds = async (c: AuthenticationCreds) => {
      await this.redis.set(`${CREDS_PREFIX}${organizationId}`, serialize(c));
    };
    return { state: { creds, keys }, saveCreds };
  }

  async connect(organizationId: string): Promise<void> {
    const conn = this.getOrCreateConnection(organizationId);
    const { state, saveCreds } = await this.loadState(organizationId);
    const hasSavedCreds = (await this.redis.get(`${CREDS_PREFIX}${organizationId}`)) !== null;

    const socket = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: ["EasyPDV", "Chrome", "126.0.0"],
      syncFullHistory: false,
    });
    conn.socket = socket;

    socket.ev.on("creds.update", () => {
      void saveCreds(socket.authState.creds);
    });

    socket.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        if (conn.connectTimeoutTimer) {
          clearTimeout(conn.connectTimeoutTimer);
          conn.connectTimeoutTimer = null;
        }
        conn.reconnectAttempts = 0;
        QRCode.toDataURL(qr)
          .then((dataUrl) => {
            conn.qrBase64 = dataUrl;
          })
          .catch(() => {
            conn.qrBase64 = null;
          });
        this.logger.log(`QR code gerado pra organização ${organizationId}`);
      }

      if (connection === "open") {
        if (conn.connectTimeoutTimer) {
          clearTimeout(conn.connectTimeoutTimer);
          conn.connectTimeoutTimer = null;
        }
        conn.reconnectAttempts = 0;
        conn.connected = true;
        conn.qrBase64 = null;
        this.logger.log(`WhatsApp conectado pra organização ${organizationId}`);
      }

      if (connection === "close") {
        conn.connected = false;
        const code = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const loggedOut = code === DisconnectReason.loggedOut;

        if (loggedOut) {
          this.logger.warn(`WhatsApp deslogado (organização ${organizationId}) — credenciais limpas, escaneie o QR de novo`);
          void this.logout(organizationId);
        } else {
          // Backoff exponencial: o WhatsApp já rejeita conexão em loop apertado
          // (código 405) — martelar o servidor deles só prolonga o bloqueio
          // (mesma cicatriz documentada no BaileysService do Saldão da Reversa).
          const delay = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** conn.reconnectAttempts, RECONNECT_MAX_DELAY_MS);
          conn.reconnectAttempts += 1;
          this.logger.warn(
            `Desconectado (${code}, organização ${organizationId}) — reconectando em ${Math.round(delay / 1000)}s (tentativa ${conn.reconnectAttempts})`,
          );
          conn.reconnectTimer = setTimeout(() => void this.connect(organizationId), delay);
        }
      }
    });

    if (hasSavedCreds && !conn.connectTimeoutTimer) {
      conn.connectTimeoutTimer = setTimeout(() => {
        if (!conn.connected && !conn.qrBase64) {
          this.logger.warn(`Timeout aguardando reconexão com credenciais salvas (organização ${organizationId}) — limpando sessão`);
          void this.clearSession(organizationId);
        }
      }, STALE_CONNECTION_TIMEOUT_MS);
    }
  }

  private async clearSession(organizationId: string): Promise<void> {
    await this.redis.del(`${CREDS_PREFIX}${organizationId}`);
    await this.redis.delPattern(`${KEY_PREFIX}${organizationId}:*`);
    const conn = this.getOrCreateConnection(organizationId);
    conn.connected = false;
    conn.qrBase64 = null;
    if (conn.reconnectTimer) {
      clearTimeout(conn.reconnectTimer);
      conn.reconnectTimer = null;
    }
    if (conn.connectTimeoutTimer) {
      clearTimeout(conn.connectTimeoutTimer);
      conn.connectTimeoutTimer = null;
    }
    conn.reconnectAttempts = 0;
  }

  /** Chamado pela tela de pareamento — logout explícito do admin (não confundir com `clearSession`, chamado internamente após um "deslogado" detectado pelo próprio WhatsApp). */
  async logout(organizationId: string): Promise<void> {
    await this.clearSession(organizationId);
    await this.connect(organizationId);
  }

  /**
   * Status pro painel admin — conecta sob demanda na primeira chamada pra
   * uma organização que ainda não tinha sessão nenhuma (nem em memória, nem
   * salva no Redis). É assim que o pareamento começa: o admin abre a tela,
   * isto dispara o `connect()`, o QR aparece no próximo poll.
   */
  async getStatus(organizationId: string): Promise<{ connected: boolean; qr: string | null }> {
    if (!this.connections.has(organizationId)) {
      await this.connect(organizationId);
    }
    const conn = this.getOrCreateConnection(organizationId);
    return { connected: conn.connected, qr: conn.qrBase64 };
  }

  isReady(organizationId: string): boolean {
    return this.connections.get(organizationId)?.connected ?? false;
  }

  async sendMessage(organizationId: string, jid: string, text: string): Promise<string | undefined> {
    const conn = this.connections.get(organizationId);
    if (!conn?.socket || !conn.connected) {
      throw new Error(`WhatsApp não conectado pra organização ${organizationId}`);
    }
    const result = await conn.socket.sendMessage(jid, { text });
    return result?.key?.id ?? undefined;
  }
}
