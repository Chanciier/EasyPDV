/** Mensagem do lembrete de renovação — texto simples, sem link nenhum (não existe painel de renovação self-service ainda). */
export function buildClubReminderMessage(customerName: string, organizationName: string, daysBeforeExpiry: number, validUntil: Date): string {
  const firstName = customerName.trim().split(/\s+/)[0] ?? customerName;
  const dateStr = validUntil.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const whenText = daysBeforeExpiry === 1 ? "amanhã" : `em ${daysBeforeExpiry} dias`;

  return (
    `Olá, ${firstName}! 👋\n\n` +
    `Seu clube na ${organizationName} vence ${whenText} (${dateStr}).\n\n` +
    `Passe na loja pra renovar e continuar aproveitando os benefícios.\n\n` +
    `${organizationName}`
  );
}
