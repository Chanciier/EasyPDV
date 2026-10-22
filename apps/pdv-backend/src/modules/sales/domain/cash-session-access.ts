import type { CashSession } from "./entities/cash-session.entity.js";
import { CashSessionNotOwnedError } from "./errors.js";

/**
 * Papéis que podem operar a sessão de caixa aberta por OUTRO operador
 * (fechar, lançar sangria/suprimento, ver o total em dinheiro). Mesma lista
 * que a tela usa em `FORCE_CLOSE_ROLES` (cash-view.tsx).
 */
export const CASH_OVERRIDE_ROLES: readonly string[] = ["administrador", "gerente", "proprietario"];

/**
 * Risco #37 (2026-10-22, SEG-09/K7/F-9): dono da sessão ou gerência. Antes a
 * restrição existia só na tela — pela API qualquer operador fechava ou
 * lançava sangria no caixa de outro.
 */
export function assertCanOperateCashSession(session: CashSession, actorUserId: string | null, actorRole: string | null): void {
  if (actorUserId !== null && session.operatorUserId === actorUserId) {
    return;
  }
  if (actorRole !== null && CASH_OVERRIDE_ROLES.includes(actorRole)) {
    return;
  }
  throw new CashSessionNotOwnedError();
}
