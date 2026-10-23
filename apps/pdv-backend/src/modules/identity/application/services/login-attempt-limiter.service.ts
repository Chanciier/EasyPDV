import { Injectable } from "@nestjs/common";

const MAX_FAILURES = 5;
const WINDOW_MS = 5 * 60 * 1000;
/** Teto de e-mails rastreados — a rota é local (127.0.0.1), mas um laço de e-mails aleatórios não deve crescer o mapa sem fim. */
const MAX_TRACKED_EMAILS = 1000;

/**
 * SEG-02 (2026-10-22): limite de tentativas do login OFFLINE (espelho local,
 * quando o Intermediador está inalcançável). O Intermediador já limita o
 * caminho online (5/min por terminal+e-mail e bloqueio de conta); sem isto,
 * bastava o Intermediador cair para o bcrypt local virar alvo de força
 * bruta ilimitada. Em memória de propósito (sem migration): reiniciar o app
 * zera o contador, o que é aceitável — o objetivo é tornar o ataque lento,
 * não auditar. Conta por e-mail, então um operador travado não trava a loja.
 */
@Injectable()
export class LoginAttemptLimiterService {
  private readonly failures = new Map<string, number[]>();

  /** `true` quando o e-mail já acumulou 5 falhas nos últimos 5 minutos. */
  isBlocked(email: string): boolean {
    return this.recentFailures(this.key(email)).length >= MAX_FAILURES;
  }

  recordFailure(email: string): void {
    const key = this.key(email);
    const recent = this.recentFailures(key);
    recent.push(Date.now());
    this.failures.set(key, recent);
    if (this.failures.size > MAX_TRACKED_EMAILS) {
      this.prune();
    }
  }

  reset(email: string): void {
    this.failures.delete(this.key(email));
  }

  private key(email: string): string {
    return email.trim().toLowerCase();
  }

  private recentFailures(key: string): number[] {
    const cutoff = Date.now() - WINDOW_MS;
    const recent = (this.failures.get(key) ?? []).filter((at) => at > cutoff);
    if (recent.length === 0) {
      this.failures.delete(key);
    }
    return recent;
  }

  private prune(): void {
    for (const key of [...this.failures.keys()]) {
      this.recentFailures(key);
    }
    // Ainda cheio depois de limpar o que expirou: descarta os mais antigos (ordem de inserção do Map).
    while (this.failures.size > MAX_TRACKED_EMAILS) {
      const oldest = this.failures.keys().next().value;
      if (oldest === undefined) break;
      this.failures.delete(oldest);
    }
  }
}
