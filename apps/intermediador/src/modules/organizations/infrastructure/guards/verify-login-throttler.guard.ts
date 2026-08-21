import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

/**
 * `POST /organizations/:id/users/verify-login` não tinha nenhum rate limit
 * (risco real identificado no planejamento do login único, 2026-08-21) —
 * chaveado por terminal (`X-Terminal-Api-Key`, já resolvido pelo
 * TerminalApiKeyGuard ANTES deste guard rodar — ver ordem em
 * `@UseGuards(TerminalApiKeyGuard, VerifyLoginThrottlerGuard)` no controller)
 * E por e-mail — uma apiKey de terminal vazada não vira tentativa ilimitada
 * contra qualquer conta da organização, e um e-mail sendo tentado de vários
 * terminais (pouco provável, mas não impossível) também é limitado por conta.
 */
@Injectable()
export class VerifyLoginThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const terminal = req.terminal as { terminalId?: string } | undefined;
    const body = req.body as { email?: unknown } | undefined;
    const terminalId = terminal?.terminalId ?? "sem-terminal";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "sem-email";
    return `${terminalId}:${email}`;
  }
}
