import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

/**
 * `POST /organizations/:id/auth/login` — sem terminal no meio (é o navegador
 * do painel direto), então chaveia por IP + e-mail em vez de terminal + e-mail
 * (mesmo espírito do VerifyLoginThrottlerGuard, adaptado: aqui o IP é o único
 * sinal de origem disponível).
 */
@Injectable()
export class OrgLoginThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const ip = typeof req.ip === "string" ? req.ip : "sem-ip";
    const body = req.body as { email?: unknown } | undefined;
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "sem-email";
    return `${ip}:${email}`;
  }
}
