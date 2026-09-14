/**
 * Brasil fixo em UTC-3 desde o fim do horário de verão (2019) — sem
 * ambiguidade de DST, o offset pode ser literal em vez de precisar de
 * timezone database (Intl só entra pra ler o "hoje" real do relógio).
 * Existe só porque o processo roda no Railway (UTC) — sem isso, "hoje" pro
 * cálculo de D-7/D-1 fica errado perto da virada do dia (mesma classe do
 * bug de fuso já corrigido no cadastro do Clube em v1.5.13).
 */
const SAO_PAULO_OFFSET = "-03:00";

/** "YYYY-MM-DD" de hoje em America/Sao_Paulo, não no fuso do processo. */
export function todaySaoPauloDateString(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
}

export function addDaysToDateString(dateString: string, days: number): string {
  // Parse como UTC meia-noite só pra aritmética de calendário — o fuso de
  // São Paulo entra depois, em saoPauloDayRange(). "YYYY-MM-DDTHH:mm:ssZ" é
  // sempre um formato válido/completo, sem índice de array que possa faltar.
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Início/fim de um dia-calendário de São Paulo, como instantes UTC reais.
 * Cobre `ClubMembership.validUntil`, que é sempre gravado como fim do dia
 * LOCAL (ver comentário `endOfDayIso` em clube-view.tsx) — aqui do lado do
 * servidor, não dá pra confiar no fuso do processo pra recriar isso.
 */
export function saoPauloDayRange(dateString: string): { start: Date; end: Date } {
  return {
    start: new Date(`${dateString}T00:00:00${SAO_PAULO_OFFSET}`),
    end: new Date(`${dateString}T23:59:59.999${SAO_PAULO_OFFSET}`),
  };
}
