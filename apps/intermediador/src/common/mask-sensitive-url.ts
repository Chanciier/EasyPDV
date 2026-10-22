/** Parâmetros de query cujo valor nunca vai pro log: OAuth do Bling (`code`/`state`) e buscas que costumam ser CPF/nome. */
const SENSITIVE_QUERY_PARAM = /([?&](?:code|state|query|q|search|document|cpf|cnpj)=)[^&#]*/gi;
/** 11 a 14 dígitos, com ou sem pontuação (`.`/`-`) — CPF e CNPJ, crus ou formatados. */
const DOCUMENT_LIKE = /\d(?:[.-]?\d){10,13}/g;

/**
 * SEG-01 (2026-10-22): mascara CPF/CNPJ e parâmetros sensíveis numa URL antes
 * de ela ir pro log do pino-http — rotas como `/club/status/:document`,
 * `/store-credit/balance/:document` e o callback OAuth do Bling
 * (`?code=…&state=…`) gravavam CPF e código OAuth em claro nos logs do
 * Railway. Cópia proposital de `apps/pdv-backend/src/common/mask-sensitive-url.ts`:
 * os dois apps não compartilham `common/`.
 */
export function maskSensitiveUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  return url.replace(SENSITIVE_QUERY_PARAM, "$1***").replace(DOCUMENT_LIKE, "***");
}
