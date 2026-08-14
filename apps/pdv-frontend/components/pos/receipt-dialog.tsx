'use client'

import { useEffect } from 'react'
import { CheckCircle2 } from 'lucide-react'
import type { Sale, PaymentMethod } from '@easypdv/shared-types'
import { Modal } from './ui/modal'
import { formatBRL } from '@/lib/pos-data'

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  pix: 'PIX',
  outro: 'Outro',
}

/**
 * `received`/`change` só existem no cupom, não no backend (Payment guarda
 * apenas `amount` — o valor efetivamente aplicado à venda). São calculados
 * no momento do pagamento em sale-view.tsx e passados aqui só para exibição.
 */
export function ReceiptDialog({
  sale,
  productNames,
  paymentMethod,
  received,
  change,
  onClose,
}: {
  sale: Sale | null
  productNames: Record<string, string>
  paymentMethod: PaymentMethod | null
  received: number
  change: number
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
            {change > 0 && (
              <div>
                <p className="text-sm text-muted-foreground">Troco</p>
                <p className="font-mono text-3xl font-bold">{formatBRL(change)}</p>
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
            {paymentMethod && (
              <div className="mt-1 flex justify-between text-muted-foreground">
                <span>{PAYMENT_LABELS[paymentMethod]}</span>
                <span>Recebido {formatBRL(received)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
