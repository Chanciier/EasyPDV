'use client'

import { useState } from 'react'
import { ShieldCheck, Filter } from 'lucide-react'
import { useAuditLogs } from '@/hooks/use-audit'

const ACTION_LABELS: Record<string, string> = {
  'sale.confirmed': 'Venda confirmada',
  'sale.cancelled': 'Venda cancelada',
  'cash_session.opened': 'Caixa aberto',
  'cash_session.closed': 'Caixa fechado',
  'cash_movement.registered': 'Movimento de caixa',
  'user.role_changed': 'Papel de usuário alterado',
  'price_list_item.upserted': 'Preço alterado',
  'stock_movement.registered': 'Movimento de estoque',
}

const ENTITY_TYPES = [
  { value: '', label: 'Todos' },
  { value: 'sale', label: 'Vendas' },
  { value: 'cash_session', label: 'Caixa' },
  { value: 'user', label: 'Usuários' },
  { value: 'product', label: 'Produtos' },
] as const

function formatMetadata(metadata: Record<string, unknown> | null): string {
  if (!metadata) return ''
  return Object.entries(metadata)
    .map(([key, value]) => `${key}: ${typeof value === 'number' ? value.toLocaleString('pt-BR') : String(value)}`)
    .join(' · ')
}

export function AuditView() {
  const [entityType, setEntityType] = useState('')
  const { data: logs = [], isLoading } = useAuditLogs({ entityType: entityType || undefined })

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
        <Filter className="size-4 text-muted-foreground" />
        <select
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          className="h-8 bg-transparent text-sm outline-none"
        >
          {ENTITY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid grid-cols-[9rem_12rem_10rem_1fr] items-center gap-3 border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Data/Hora</span>
          <span>Ação</span>
          <span>Usuário</span>
          <span>Detalhes</span>
        </div>
        <div className="h-full overflow-y-auto pb-4">
          {!isLoading && logs.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
              <ShieldCheck className="size-8 opacity-30" />
              <p className="text-sm">Nenhum evento registrado ainda.</p>
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="grid grid-cols-[9rem_12rem_10rem_1fr] items-center gap-3 border-b border-border/60 px-4 py-2.5 text-sm"
              >
                <span className="text-muted-foreground">
                  {new Date(log.createdAt).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span className="truncate font-medium">{ACTION_LABELS[log.action] ?? log.action}</span>
                <span className="truncate font-mono text-xs text-muted-foreground">
                  {log.userId ?? '—'}
                </span>
                <span className="truncate text-xs text-muted-foreground">{formatMetadata(log.metadata)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
