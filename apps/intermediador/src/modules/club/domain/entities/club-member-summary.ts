/**
 * Combina o contato do Bling (fonte da verdade de "é do clube") com a
 * validade local (Bling não tem campo nativo pra isso — ver ClubMembership).
 * `validUntil: null` acontece quando um contato tem a tag "Clube Saldão" no
 * Bling mas não tem uma linha correspondente em `ClubMembership` (ex.:
 * alguém marcou a tag manualmente no painel do Bling, fora do EasyPDV).
 */
export interface ClubMemberSummary {
  document: string;
  name: string;
  validUntil: string | null;
}
