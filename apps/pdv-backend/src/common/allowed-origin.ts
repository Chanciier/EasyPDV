/**
 * Compartilhado entre o CORS do REST (main.ts) e do WebSocket
 * (realtime.gateway.ts) — antes o WebSocket usava `origin: true` (libera
 * geral), reabrindo parcialmente o vetor que o hardening do REST fechou
 * (achado M3 da auditoria de segurança, 2026-09-14): qualquer página aberta
 * no navegador do PC do PDV (que também navega a internet geral) conseguia
 * ler os eventos de venda broadcast pelo gateway.
 *
 * `file://` (Electron via loadFile) é sempre permitido; `localhost`/
 * `127.0.0.1` só fora de produção, pra não travar o `next dev`.
 */
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin || origin === "null" || origin.startsWith("file://")) {
    return true;
  }
  const isProduction = process.env.NODE_ENV === "production";
  return !isProduction && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}
