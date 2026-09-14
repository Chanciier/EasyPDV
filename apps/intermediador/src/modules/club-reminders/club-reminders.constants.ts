export const CLUB_REMINDER_QUEUE_NAME = "club-reminders";
export const CLUB_REMINDER_JOB_NAME = "send-club-reminder";

/**
 * D-7 e D-1 antes do vencimento — sugestão do planejamento original, NÃO
 * uma decisão fechada com o usuário ("Quantos dias antes / quantos toques
 * — segue sem definição fina", ver "Planejamento - Lembrete de Renovação
 * do Clube.md" no cofre Obsidian, seção "Ainda em aberto"). Mudar aqui se
 * a decisão vier depois.
 */
export const REMINDER_DAYS_BEFORE = [7, 1] as const;
