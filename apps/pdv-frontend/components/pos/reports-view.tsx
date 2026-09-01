'use client'

import { useMemo, useState } from 'react'
import { BarChart3, Boxes, Receipt, Wallet } from 'lucide-react'
import { toBrazilDateString } from '@easypdv/shared-validation'
import { formatBRL } from '@/lib/pos-data'
import { useCashSessionsReport, useSalesReport, useStockReport } from '@/hooks/use-reports'
import { useProducts } from '@/hooks/use-sales'

function defaultFrom(): string {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return toBrazilDateString(d)
}

export function ReportsView() {
  const [from, setFrom] = useState(defaultFrom())
  const [to, setTo] = useState(toBrazilDateString(new Date()))

  const { data: salesReport = [], isLoading: loadingSales } = useSalesReport({ from, to })
  const { data: cashSessions = [], isLoading: loadingCash } = useCashSessionsReport({ from, to })
  const { data: stock = [], isLoading: loadingStock } = useStockReport()

  const stockProductIds = useMemo(() => stock.map((s) => s.productId), [stock])
  const stockProductQueries = useProducts(stockProductIds)
  const stockProductNames = useMemo(() => {
    const map: Record<string, string> = {}
    stockProductIds.forEach((id, idx) => {
      const name = stockProductQueries[idx]?.data?.name
      if (name) map[id] = name
    })
    return map
  }, [stockProductIds, stockProductQueries])

  const salesTotals = useMemo(
    () =>
      salesReport.reduce(
        (acc, entry) => ({ count: acc.count + entry.salesCount, total: acc.total + entry.totalAmount }),
        { count: 0, total: 0 },
      ),
    [salesReport],
  )

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
        <BarChart3 className="size-4 text-muted-foreground" />
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          De
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-8 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          Até
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-8 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-primary"
          />
        </label>
      </div>

      {/* Vendas por período */}
      <section className="rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <Receipt className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Vendas por período</h2>
          <span className="ml-auto text-xs text-muted-foreground">
            {salesTotals.count} vendas · {formatBRL(salesTotals.total)}
          </span>
        </div>
        <div className="grid grid-cols-[1fr_8rem_10rem] items-center gap-3 border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Período</span>
          <span className="text-right">Vendas</span>
          <span className="text-right">Total</span>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {!loadingSales && salesReport.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nenhuma venda no período.</p>
          ) : (
            salesReport.map((entry) => (
              <div
                key={entry.period}
                className="grid grid-cols-[1fr_8rem_10rem] items-center gap-3 border-b border-border/60 px-4 py-2 text-sm"
              >
                <span>{entry.period}</span>
                <span className="text-right font-mono">{entry.salesCount}</span>
                <span className="text-right font-mono font-semibold">{formatBRL(entry.totalAmount)}</span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Caixas fechados */}
      <section className="rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <Wallet className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Caixas fechados</h2>
        </div>
        <div className="grid grid-cols-[10rem_8rem_8rem_8rem_8rem] items-center gap-3 border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Fechado em</span>
          <span className="text-right">Abertura</span>
          <span className="text-right">Fechamento</span>
          <span className="text-right">Esperado</span>
          <span className="text-right">Divergência</span>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {!loadingCash && cashSessions.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhum caixa fechado no período.
            </p>
          ) : (
            cashSessions.map((session) => {
              const divergence = (session.closingAmount ?? 0) - (session.expectedAmount ?? 0)
              return (
                <div
                  key={session.id}
                  className="grid grid-cols-[10rem_8rem_8rem_8rem_8rem] items-center gap-3 border-b border-border/60 px-4 py-2 text-sm"
                >
                  <span className="text-muted-foreground">
                    {session.closedAt ? new Date(session.closedAt).toLocaleString('pt-BR') : '—'}
                  </span>
                  <span className="text-right font-mono">{formatBRL(session.openingAmount)}</span>
                  <span className="text-right font-mono">{formatBRL(session.closingAmount ?? 0)}</span>
                  <span className="text-right font-mono">{formatBRL(session.expectedAmount ?? 0)}</span>
                  <span
                    className={`text-right font-mono font-semibold ${
                      divergence === 0 ? 'text-muted-foreground' : divergence > 0 ? 'text-primary' : 'text-destructive'
                    }`}
                  >
                    {formatBRL(divergence)}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </section>

      {/* Estoque */}
      <section className="rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <Boxes className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Estoque atual</h2>
        </div>
        <div className="grid grid-cols-[1fr_8rem] items-center gap-3 border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Produto</span>
          <span className="text-right">Quantidade</span>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {!loadingStock && stock.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nenhum item de estoque.</p>
          ) : (
            stock.map((item) => (
              <div
                key={`${item.warehouseId}-${item.productId}`}
                className="grid grid-cols-[1fr_8rem] items-center gap-3 border-b border-border/60 px-4 py-2 text-sm"
              >
                <span className="truncate">{stockProductNames[item.productId] ?? item.productId}</span>
                <span className="text-right font-mono">{item.quantity}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
