'use client'

import { useEffect } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Modal } from './ui/modal'
import { formatBRL, PAYMENT_LABELS, type Sale } from '@/lib/pos-data'

export function ReceiptDialog({
  sale,
  onClose,
}: {
  sale: Sale | null
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
            <div>
              <p className="text-sm text-muted-foreground">Troco</p>
              <p className="font-mono text-3xl font-bold">{formatBRL(sale.change)}</p>
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-border p-4 font-mono text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Cupom</span>
              <span>{sale.id}</span>
            </div>
            <div className="my-2 border-t border-dashed border-border" />
            {sale.items.map((i) => (
              <div key={i.productId} className="flex justify-between py-0.5">
                <span className="truncate pr-2">
                  {i.qty}x {i.name}
                </span>
                <span>{formatBRL(i.price * i.qty - i.discount)}</span>
              </div>
            ))}
            <div className="my-2 border-t border-dashed border-border" />
            {sale.discount > 0 && (
              <div className="flex justify-between text-accent">
                <span>Desconto</span>
                <span>- {formatBRL(sale.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold">
              <span>Total</span>
              <span>{formatBRL(sale.total)}</span>
            </div>
            <div className="mt-1 flex justify-between text-muted-foreground">
              <span>{PAYMENT_LABELS[sale.paymentMethod]}</span>
              <span>Recebido {formatBRL(sale.received)}</span>
            </div>
            {sale.customerName && (
              <div className="mt-2 text-muted-foreground">Cliente: {sale.customerName}</div>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
