'use client'

import { useMemo, useState } from 'react'
import { Search, Receipt, TrendingUp, Hash } from 'lucide-react'
import { usePOS } from './pos-provider'
import { formatBRL, PAYMENT_LABELS, normalize, type Sale } from '@/lib/pos-data'
import { Modal } from './ui/modal'

export function HistoryView() {
  const { sales } = usePOS()
  const [term, setTerm] = useState('')
  const [detail, setDetail] = useState<Sale | null>(null)

  const filtered = useMemo(() => {
    const t = normalize(term)
    if (!t) return sales
    return sales.filter(
      (s) =>
        normalize(s.id).includes(t) ||
        (s.customerName ? normalize(s.customerName).includes(t) : false) ||
        normalize(PAYMENT_LABELS[s.paymentMethod]).includes(t),
    )
  }, [term, sales])

  const totalSold = sales.reduce((sum, s) => sum + s.total, 0)

  return (
    <div className="flex h-full flex-col p-4">
      {/* Resumo do dia */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat icon={Hash} label="Vendas" value={String(sales.length)} />
        <Stat icon={TrendingUp} label="Total vendido" value={formatBRL(totalSold)} />
        <Stat
          icon={Receipt}
          label="Ticket médio"
          value={formatBRL(sales.length ? totalSold / sales.length : 0)}
        />
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-card px-3">
        <Search className="size-4 text-muted-foreground" />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar por cupom, cliente ou forma de pagamento"
          className="h-10 w-full bg-transparent text-sm outline-none"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid grid-cols-[7rem_1fr_9rem_8rem_7rem] items-center gap-3 border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Cupom</span>
          <span>Cliente</span>
          <span>Pagamento</span>
          <span>Hora</span>
          <span className="text-right">Total</span>
        </div>
        <div className="h-full overflow-y-auto pb-16">
          {filtered.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Receipt className="size-8 opacity-30" />
              <p className="text-sm">Nenhuma venda registrada ainda.</p>
            </div>
          ) : (
            filtered.map((s) => (
              <button
                key={s.id}
                onClick={() => setDetail(s)}
                className="grid w-full grid-cols-[7rem_1fr_9rem_8rem_7rem] items-center gap-3 border-b border-border/60 px-4 py-2.5 text-left text-sm hover:bg-muted/50"
              >
                <span className="font-mono text-xs text-muted-foreground">{s.id}</span>
                <span className="truncate font-medium">{s.customerName ?? 'Consumidor Final'}</span>
                <span className="text-muted-foreground">{PAYMENT_LABELS[s.paymentMethod]}</span>
                <span className="text-muted-foreground">
                  {new Date(s.createdAt).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span className="text-right font-mono font-semibold">{formatBRL(s.total)}</span>
              </button>
            ))
          )}
        </div>
      </div>

      <Modal
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={`Cupom ${detail?.id ?? ''}`}
        footer={
          <button
            onClick={() => window.print()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Reimprimir
          </button>
        }
      >
        {detail && (
          <div className="space-y-3 font-mono text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>{new Date(detail.createdAt).toLocaleString('pt-BR')}</span>
              <span>{detail.operator}</span>
            </div>
            <div className="border-t border-dashed border-border" />
            {detail.items.map((i) => (
              <div key={i.productId} className="flex justify-between">
                <span className="truncate pr-2">
                  {i.qty}x {i.name}
                </span>
                <span>{formatBRL(i.price * i.qty - i.discount)}</span>
              </div>
            ))}
            <div className="border-t border-dashed border-border" />
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatBRL(detail.subtotal)}</span>
            </div>
            {detail.discount > 0 && (
              <div className="flex justify-between text-accent">
                <span>Desconto</span>
                <span>- {formatBRL(detail.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold">
              <span>Total</span>
              <span>{formatBRL(detail.total)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>{PAYMENT_LABELS[detail.paymentMethod]}</span>
              <span>
                Recebido {formatBRL(detail.received)} · Troco {formatBRL(detail.change)}
              </span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Hash
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="size-4" />
        {label}
      </div>
      <p className="mt-2 font-mono text-2xl font-bold">{value}</p>
    </div>
  )
}
