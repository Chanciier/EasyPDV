'use client'

import { useEffect } from 'react'
import { CheckCircle2 } from 'lucide-react'
import type { Payment, PaymentMethod, Sale } from '@easypdv/shared-types'
import { Modal } from './ui/modal'
import { formatBRL } from '@/lib/pos-data'

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  pix: 'PIX',
  vale_troca: 'Vale-Troca',
  outro: 'Outro',
}

const BRAND_LABELS: Record<string, string> = {
  mastercard: 'Mastercard',
  visa: 'Visa',
}

/** Bandeira do cartão (2026-08-21) — mesmo formato de payment-dialog.tsx/sale-view.tsx. */
function paymentLabel(payment: Payment): string {
  if (!payment.cardType) return PAYMENT_LABELS[payment.method]
  const tipo = payment.cardType === 'credito' ? 'Crédito' : 'Débito'
  const bandeira = payment.cardBrand ? BRAND_LABELS[payment.cardBrand] : null
  return bandeira ? `${tipo} (${bandeira})` : tipo
}

/**
 * Pagamento dividido (2026-08-21) — `sale.payments` já traz método/valor de
 * cada perna (persistido de verdade); só o troco total (`changeTotal`) é
 * calculado à parte em sale-view.tsx, porque "recebido" em dinheiro nunca é
 * persistido (Payment guarda só `amount`, o valor efetivamente aplicado).
 */
export function ReceiptDialog({
  sale,
  productNames,
  changeTotal,
  onClose,
}: {
  sale: Sale | null
  productNames: Record<string, string>
  changeTotal: number
  onClose: () => void
}) {
  useEffect(() => {
    if (!sale) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [sale, onClose])

  return (
    <Modal
      open={!!sale}
      onClose={onClose}
      title="Venda concluída"
      size="sm"
      footer={
        <button
          onClick={onClose}
          className="w-full rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Nova venda (Enter)
        </button>
      }
    >
      {sale && (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-2 py-2 text-center">
            <CheckCircle2 className="size-12 text-primary" />
            {changeTotal > 0 && (
              <div>
                <p className="text-sm text-muted-foreground">Troco</p>
                <p className="font-mono text-3xl font-bold">{formatBRL(changeTotal)}</p>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-dashed border-border p-4 font-mono text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Cupom</span>
              <span>{sale.id}</span>
            </div>
            <div className="my-2 border-t border-dashed border-border" />
            {sale.items.map((i) => (
              <div key={i.id} className="flex justify-between py-0.5">
                <span className="truncate pr-2">
                  {i.quantity}x {productNames[i.productId] ?? i.productId}
                </span>
                <span>{formatBRL(i.totalAmount)}</span>
              </div>
            ))}
            <div className="my-2 border-t border-dashed border-border" />
            <div className="flex justify-between text-sm font-bold">
              <span>Total</span>
              <span>{formatBRL(sale.totalAmount)}</span>
            </div>
            {sale.payments
              .filter((p) => p.status === 'aprovado')
              .map((p) => (
                <div key={p.id} className="mt-1 flex justify-between text-muted-foreground">
                  <span>{paymentLabel(p)}</span>
                  <span>{formatBRL(p.amount)}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </Modal>
  )
}
