import type { ConfigService } from "@nestjs/config";

/** Só usado quando `INTERMEDIADOR_URL` não está configurada (dev local, `next dev`). */
export const INTERMEDIADOR_URL_DEFAULT = "http://127.0.0.1:4002";

/**
 * Timeout padrão pra chamadas HTTP ao Intermediador que não têm um motivo
 * específico pra usar outro valor (ex: import em lote, que já usa um timeout
 * próprio maior). Sem isso, `fetch` do Node não tem timeout nenhum — um
 * Intermediador travado (não "fora do ar", que falha rápido, mas pendurado)
 * deixaria a chamada esperando indefinidamente.
 */
export const DEFAULT_INTERMEDIADOR_TIMEOUT_MS = 8000;

/** Lê `INTERMEDIADOR_URL`, centralizando o default usado por todos os gateways HTTP pro Intermediador. */
export function getIntermediadorUrl(configService: ConfigService): string {
  return configService.get<string>("INTERMEDIADOR_URL") ?? INTERMEDIADOR_URL_DEFAULT;
}
