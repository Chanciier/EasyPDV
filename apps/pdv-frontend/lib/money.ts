/** Arredonda pra 2 casas decimais — mesma fórmula repetida solta em vários componentes de venda/pagamento. */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

/** Converte um percentual num valor em reais sobre uma base, já arredondado — usado nos vários fluxos de desconto (geral, por item, de clube). */
export function percentToAmount(base: number, percent: number): number {
  return roundMoney(base * (percent / 100))
}
