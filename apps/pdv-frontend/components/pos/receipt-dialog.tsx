'use client'

import { useEffect, useRef } from 'react'
import { CheckCircle2, Printer } from 'lucide-react'
import type { Sale } from '@easypdv/shared-types'
import { Modal } from './ui/modal'
import { formatBRL } from '@/lib/pos-data'
import { paymentLabel } from '@/lib/payment-labels'

/**
 * Enter nos primeiros instantes do recibo é ignorado (UX-19): um Enter
 * repetido logo depois de "Confirmar venda" fechava o recibo antes do
 * operador ler o troco.
 */
const ENTER_GUARD_MS = 500

/**
 * Pagamento dividido (2026-08-21) — `sale.payments` já traz método/valor de
 * cada perna (persistido de verdade); só o troco total (`changeTotal`) é
 * calculado à parte em sale-view.tsx, porque "recebido" em dinheiro nunca é
 * persistido (Payment guarda só `amount`, o valor efetivamente aplicado).
 *
 * "Imprimir de novo" + erro de impressão (UX-13, 2026-10-22): antes, impressora
 * sem papel/desligada não dava aviso nenhum e não havia como reimprimir o
 * cupom da venda que acabou de sair.
 */
export function ReceiptDialog({
  sale,
  productNames,
  changeTotal,
  onClose,
  onReprint,
  printing = false,
  printError = null,
}: {
  sale: Sale | null
  productNames: Record<string, string>
  changeTotal: number
  onClose: () => void
  /** Ausente = sem impressora (fora do Electron) — o botão não aparece. */
  onReprint?: () => void
  printing?: boolean
  printError?: string | null
}) {
  const openedAtRef = useRef(0)

  useEffect(() => {
    if (!sale) return
    openedAtRef.current = Date.now()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        if (e.repeat || Date.now() - openedAtRef.current < ENTER_GUARD_MS) return
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
        <div className="flex w-full flex-col gap-2">
          {onReprint && (
            <button
              onClick={onReprint}
              disabled={printing}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Printer className="size-4" />
              {printing ? 'Imprimindo…' : 'Imprimir de novo'}
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Nova venda (Enter)
          </button>
        </div>
      }
    >
      {sale && (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-2 py-2 text-center">
            <CheckCircle2 className="size-12 text-primary-foreground" />
            {changeTotal > 0 && (
              <div>
                <p className="text-sm text-muted-foreground">Troco</p>
                <p className="font-mono text-3xl font-bold">{formatBRL(changeTotal)}</p>
              </div>
            )}
          </div>

          {printError && (
            <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{printError}</div>
          )}

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
