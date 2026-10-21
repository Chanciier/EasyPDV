'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, Wallet } from 'lucide-react'
import { formatCpf } from '@easypdv/shared-validation'
import { formatBRL } from '@/lib/pos-data'
import { describeError } from '@/lib/api-client'
import { useStoreCreditBalances } from '@/hooks/use-store-credit'

const PAGE_SIZE = 100

/** Aba "Clientes com saldo" da tela Vale-Troca — só gerência (restrição real no backend). */
export function StoreCreditBalancesTab() {
  const [term, setTerm] = useState('')
  const [debouncedTerm, setDebouncedTerm] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedTerm(term.trim()), 250)
    return () => clearTimeout(t)
  }, [term])
  useEffect(() => setVisibleCount(PAGE_SIZE), [debouncedTerm])

  const { data: rows = [], isLoading, error } = useStoreCreditBalances(debouncedTerm)
  const visible = useMemo(() => rows.slice(0, visibleCount), [rows, visibleCount])
  const total = useMemo(() => rows.reduce((sum, r) => sum + r.balance, 0), [rows])

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Buscar por nome ou CPF"
            className="pos-input flex-1 border-0 bg-transparent"
          />
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
          <Wallet className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">{rows.length} cliente(s) · total</span>
          <span className="font-mono font-semibold">{formatBRL(total)}</span>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{describeError(error)}</p>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum cliente com vale-troca.</p>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">CPF</th>
                <th className="px-3 py-2">Telefone</th>
                <th className="px-3 py-2 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.customerCpf} className="border-t border-border">
                  <td className="px-3 py-2">{r.customerName ?? '—'}</td>
                  <td className="px-3 py-2 font-mono">{formatCpf(r.customerCpf)}</td>
                  <td className="px-3 py-2">{r.customerPhone ?? '—'}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">{formatBRL(r.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > visibleCount && (
            <div className="flex items-center justify-center gap-3 p-3 text-sm text-muted-foreground">
              Mostrando {visibleCount} de {rows.length}
              <button onClick={() => setVisibleCount((n) => n + PAGE_SIZE)} className="underline hover:text-foreground">
                Mostrar mais
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
