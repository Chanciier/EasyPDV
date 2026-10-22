'use client'

import { useMemo, useState } from 'react'
import { BarChart3, Boxes, Receipt, Search, Wallet } from 'lucide-react'
import { toBrazilDateString } from '@easypdv/shared-validation'
import { formatBRL } from '@/lib/pos-data'
import { useCashSessionsReport, useSalesReport, useStockReport, type StockReportRow } from '@/hooks/use-reports'

const STOCK_PAGE_SIZE = 100

/**
 * Negativos primeiro (mais negativo no topo), depois zerados, depois o resto
 * por nome — é o que o gerente procura ao abrir o relatório.
 */
function compareStockRows(a: StockReportRow, b: StockReportRow): number {
  const rank = (q: number) => (q < 0 ? 0 : q === 0 ? 1 : 2)
  const ra = rank(a.quantity)
  const rb = rank(b.quantity)
  if (ra !== rb) return ra - rb
  if (ra === 0 && a.quantity !== b.quantity) return a.quantity - b.quantity
  return (a.name ?? '').localeCompare(b.name ?? '', 'pt-BR')
}

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

  // PERF-01: nome/SKU já vêm na linha do relatório; render limitado a 100
  // linhas por vez (mesmo padrão da tela Produtos) e busca filtrada no cliente.
  const [stockTerm, setStockTerm] = useState('')
  const [stockVisible, setStockVisible] = useState(STOCK_PAGE_SIZE)
  const sortedStock = useMemo(() => [...stock].sort(compareStockRows), [stock])
  const filteredStock = useMemo(() => {
    const term = stockTerm.trim().toLocaleLowerCase('pt-BR')
    if (!term) return sortedStock
    return sortedStock.filter(
      (item) =>
        (item.name ?? '').toLocaleLowerCase('pt-BR').includes(term) ||
        (item.sku ?? '').toLocaleLowerCase('pt-BR').includes(term),
    )
  }, [sortedStock, stockTerm])
  const visibleStock = useMemo(() => filteredStock.slice(0, stockVisible), [filteredStock, stockVisible])

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
                      divergence === 0 ? 'text-muted-foreground' : divergence > 0 ? 'text-primary-foreground' : 'text-destructive'
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
          <label className="ml-auto flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2 focus-within:border-primary">
            <Search className="size-3.5 text-muted-foreground" />
            <input
              type="text"
              value={stockTerm}
              onChange={(e) => {
                setStockTerm(e.target.value)
                setStockVisible(STOCK_PAGE_SIZE)
              }}
              placeholder="Buscar por nome ou SKU"
              aria-label="Buscar produto no estoque"
              className="w-56 bg-transparent text-sm outline-none"
            />
          </label>
        </div>
        <div className="grid grid-cols-[8rem_1fr_8rem] items-center gap-3 border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>SKU</span>
          <span>Produto</span>
          <span className="text-right">Quantidade</span>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {loadingStock ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Carregando estoque…</p>
          ) : filteredStock.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              {stock.length === 0 ? 'Nenhum item de estoque.' : 'Nenhum produto encontrado.'}
            </p>
          ) : (
            visibleStock.map((item) => (
              <div
                key={`${item.warehouseId}-${item.productId}`}
                className="grid grid-cols-[8rem_1fr_8rem] items-center gap-3 border-b border-border/60 px-4 py-2 text-sm"
              >
                <span className="truncate font-mono text-muted-foreground">{item.sku || '—'}</span>
                <span className="truncate">{item.name || item.productId}</span>
                <span
                  className={`text-right font-mono ${
                    item.quantity < 0 ? 'font-semibold text-destructive' : item.quantity === 0 ? 'font-semibold' : ''
                  }`}
                >
                  {item.quantity}
                </span>
              </div>
            ))
          )}
          {filteredStock.length > 0 && (
            <div className="flex items-center justify-center gap-3 py-3 text-sm text-muted-foreground">
              <span>
                Mostrando {visibleStock.length} de {filteredStock.length}
              </span>
              {filteredStock.length > stockVisible && (
                <button
                  onClick={() => setStockVisible((n) => n + STOCK_PAGE_SIZE)}
                  className="rounded-lg border border-border px-3 py-1.5 font-medium text-foreground hover:bg-muted"
                >
                  Mostrar mais
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
