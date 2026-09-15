import { Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";

interface StateEntry {
  organizationId: string;
  expiresAt: number;
}

/**
 * Achado C2 da auditoria de segurança (2026-09-14, cofre Obsidian "Auditoria
 * de Segurança Completa — EasyPDV"): o `state` do OAuth do Bling era só
 * `base64url(organizationId)` — qualquer atacante calculava o próprio sem
 * nunca chamar /connect, deixando a conexão Bling sequestrável. Aqui o
 * `state` vira um token opaco de alta entropia, de uso único, com TTL curto,
 * guardado em memória (não Postgres/Redis de propósito — é um único
 * Intermediador, não escalado horizontalmente, e o fluxo inteiro dura
 * segundos/minutos de uma ação manual de admin; perder o state num restart
 * do processo só obriga a tentar de novo, sem risco de dado).
 */
@Injectable()
export class BlingOAuthStateStore {
  private static readonly TTL_MS = 10 * 60 * 1000;
  private readonly states = new Map<string, StateEntry>();

  create(organizationId: string): string {
    this.evictExpired();
    const state = randomBytes(32).toString("base64url");
    this.states.set(state, { organizationId, expiresAt: Date.now() + BlingOAuthStateStore.TTL_MS });
    return state;
  }

  /** Uso único: consome (remove) o state ao ler, válido ou não. `null` se nunca existiu, já foi usado, ou expirou. */
  consume(state: string): string | null {
    const entry = this.states.get(state);
    if (!entry) return null;
    this.states.delete(state);
    if (Date.now() > entry.expiresAt) return null;
    return entry.organizationId;
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.states) {
      if (now > entry.expiresAt) this.states.delete(key);
    }
  }
}
