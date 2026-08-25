/** Fixo, direto no código (decisão do usuário — ver Planejamento - Clube Saldão.md seção 5.7). Mudar exige código novo + release, não é configurável. */
export const CLUB_DISCOUNT_RATE = 0.3;

export function computeClubDiscountAmount(subtotal: number): number {
  return Math.round(subtotal * CLUB_DISCOUNT_RATE * 100) / 100;
}
