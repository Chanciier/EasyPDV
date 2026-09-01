/**
 * Data (YYYY-MM-DD) de um instante, no fuso de Brasília — nunca
 * `date.toISOString().slice(0, 10)`. `toISOString()` sempre devolve UTC:
 * qualquer evento entre ~21h e 23h59 no horário de Brasília (UTC-3, sem
 * horário de verão desde 2019) já virou o dia seguinte em UTC, então fatiar
 * a string ISO pega a data ERRADA (um dia à frente). Bug real de produção
 * (2026-09-02): vendas confirmadas à noite geravam pedido — e a NFC-e gerada
 * a partir dele, que herda a data do pedido — com a data de amanhã no Bling.
 * `Intl.DateTimeFormat` com `timeZone` explícito resolve isso corretamente
 * (e sobrevive a qualquer mudança futura de horário de verão, diferente de
 * simplesmente subtrair 3h na mão).
 */
export function toBrazilDateString(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
