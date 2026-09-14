/**
 * Normaliza telefone BR (só dígitos, com ou sem "55" na frente) pro JID do
 * WhatsApp. Mesma lógica de `OrderWhatsappService.toJid` do Saldão da
 * Reversa (módulo estudado antes de decidir por Baileys — ver "API de
 * WhatsApp (Baileys).md" no cofre Obsidian).
 */
export function toWhatsappJid(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length > 11 && digits.startsWith("55")) digits = digits.slice(2);
  if (digits.length < 10 || digits.length > 11) return null;
  return `55${digits}@s.whatsapp.net`;
}
