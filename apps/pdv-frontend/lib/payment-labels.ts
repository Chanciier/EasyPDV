import type { Payment, PaymentCardBrand, PaymentMethod } from '@easypdv/shared-types'

// Extraído (2026-09-17) depois de duplicado idêntico em payment-dialog.tsx,
// receipt-dialog.tsx, sale-view.tsx e history-view.tsx.
export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  pix: 'PIX',
  vale_troca: 'Vale-Troca',
  outro: 'Outro',
}

export const BRAND_LABELS: Record<PaymentCardBrand, string> = {
  mastercard: 'Mastercard',
  visa: 'Visa',
}

/** "Crédito (Mastercard) 3x" — usado onde as parcelas importam (tela de venda, diálogo de pagamento). */
export function paymentDisplayLabel(payment: Payment): string {
  if (!payment.cardType) return PAYMENT_LABELS[payment.method]
  const tipo = payment.cardType === 'credito' ? 'Crédito' : 'Débito'
  const bandeira = payment.cardBrand ? BRAND_LABELS[payment.cardBrand] : null
  const parcelas = payment.installments && payment.installments > 1 ? ` ${payment.installments}x` : ''
  return bandeira ? `${tipo} (${bandeira})${parcelas}` : `${tipo}${parcelas}`
}

/** Sem parcelas — usado no cupom impresso e no histórico, onde cada parcela já aparece como linha separada. */
export function paymentLabel(payment: Payment): string {
  if (!payment.cardType) return PAYMENT_LABELS[payment.method]
  const tipo = payment.cardType === 'credito' ? 'Crédito' : 'Débito'
  const bandeira = payment.cardBrand ? BRAND_LABELS[payment.cardBrand] : null
  return bandeira ? `${tipo} (${bandeira})` : tipo
}
