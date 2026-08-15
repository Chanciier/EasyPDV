'use client'

import { useMemo, useState } from 'react'
import { Search, Receipt, TrendingUp, Hash, CheckCircle2, Clock3, AlertCircle, Ban, ExternalLink } from 'lucide-react'
import type { FiscalDocument, PaymentMethod, Sale } from '@easypdv/shared-types'
import { formatBRL, normalize } from '@/lib/pos-data'
import { useFiscalStatus, useProducts, useSalesList } from '@/hooks/use-sales'
import { Modal } from './ui/modal'

const FISCAL_STATUS_META: Record<
  FiscalDocument['status'],
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  pending: { label: 'NFC-e pendente', icon: Clock3, className: 'bg-muted text-muted-foreground' },
  issued: { label: 'NFC-e emitida', icon: CheckCircle2, className: 'bg-primary/10 text-primary' },
  cancelled: { label: 'NFC-e cancelada', icon: Ban, className: 'bg-muted text-muted-foreground' },
  error: { label: 'Erro na NFC-e', icon: AlertCircle, className: 'bg-destructive/10 text-destructive' },
}

function FiscalStatusBadge({ saleId }: { saleId: string }) {
  const { data: fiscal } = useFiscalStatus(saleId)
  if (!fiscal) return null

  const meta = FISCAL_STATUS_META[fiscal.status]
  const Icon = meta.icon

  return (
    <div
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-sans text-xs font-medium ${meta.className}`}
    >
      <Icon className="size-3.5" />
      {meta.label}
      {fiscal.documentNumber && <span className="opacity-70">#{fiscal.documentNumber}</span>}
      {fiscal.status === 'issued' && fiscal.danfeUrl && (
        <a
          href={fiscal.danfeUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-0.5 underline underline-offset-2 hover:opacity-80"
          title="Ver DANFE"
        >
          DANFE
          <ExternalLink className="size-3" />
        </a>
      )}
      {fiscal.status === 'error' && fiscal.errorMessage && (
        <span className="truncate opacity-70" title={fiscal.errorMessage}>
          {fiscal.errorMessage}
        </span>
      )}
    </div>
  )
}

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  pix: 'PIX',
  outro: 'Outro',
}

export function HistoryView() {
  const { data: sales = [], isLoading } = useSalesList({ status: 'confirmed' })
  const [term, setTerm] = useState('')
  const [detail, setDetail] = useState<Sale | null>(null)

  const filtered = useMemo(() => {
    const t = normalize(term)
    if (!t) return sales
    return sales.filter((s) => {
      const paymentLabel = s.payments[0] ? PAYMENT_LABELS[s.payments[0].method] : ''
      return normalize(s.id).includes(t) || normalize(paymentLabel).includes(t)
    })
  }, [term, sales])

  const totalSold = sales.reduce((sum, s) => sum + s.totalAmount, 0)

  const detailProductIds = useMemo(() => detail?.items.map((i) => i.productId) ?? [], [detail])
  const detailProductQueries = useProducts(detailProductIds)
  const detailProductNames = useMemo(() => {
    const map: Record<string, string> = {}
    detailProductIds.forEach((id, idx) => {
      const name = detailProductQueries[idx]?.data?.name
      if (name) map[id] = name
    })
    return map
  }, [detailProductIds, detailProductQueries])

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
          placeholder="Buscar por cupom ou forma de pagamento"
          className="h-10 w-full bg-transparent text-sm outline-none"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid grid-cols-[10rem_1fr_9rem_8rem_7rem] items-center gap-3 border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Cupom</span>
          <span>Cliente</span>
          <span>Pagamento</span>
          <span>Hora</span>
          <span className="text-right">Total</span>
        </div>
        <div className="h-full overflow-y-auto pb-16">
          {!isLoading && filtered.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Receipt className="size-8 opacity-30" />
              <p className="text-sm">Nenhuma venda registrada ainda.</p>
            </div>
          ) : (
            filtered.map((s) => (
              <button
                key={s.id}
                onClick={() => setDetail(s)}
                className="grid w-full grid-cols-[10rem_1fr_9rem_8rem_7rem] items-center gap-3 border-b border-border/60 px-4 py-2.5 text-left text-sm hover:bg-muted/50"
              >
                <span className="truncate font-mono text-xs text-muted-foreground">{s.id}</span>
                <span className="truncate font-medium">
                  {s.customerId ?? 'Consumidor Final'}
                </span>
                <span className="text-muted-foreground">
                  {s.payments[0] ? PAYMENT_LABELS[s.payments[0].method] : '—'}
                </span>
                <span className="text-muted-foreground">
                  {s.confirmedAt
                    ? new Date(s.confirmedAt).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—'}
                </span>
                <span className="text-right font-mono font-semibold">{formatBRL(s.totalAmount)}</span>
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
              <span>{detail.confirmedAt ? new Date(detail.confirmedAt).toLocaleString('pt-BR') : '—'}</span>
              <span>{detail.customerId ?? 'Consumidor Final'}</span>
            </div>
            <FiscalStatusBadge saleId={detail.id} />
            <div className="border-t border-dashed border-border" />
            {detail.items.map((i) => (
              <div key={i.id} className="flex justify-between">
                <span className="truncate pr-2">
                  {i.quantity}x {detailProductNames[i.productId] ?? '…'}
                </span>
                <span>{formatBRL(i.totalAmount)}</span>
              </div>
            ))}
            <div className="border-t border-dashed border-border" />
            <div className="flex justify-between text-base font-bold">
              <span>Total</span>
              <span>{formatBRL(detail.totalAmount)}</span>
            </div>
            {detail.payments.map((p) => (
              <div key={p.id} className="flex justify-between text-muted-foreground">
                <span>{PAYMENT_LABELS[p.method]}</span>
                <span>{formatBRL(p.amount)}</span>
              </div>
            ))}
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
