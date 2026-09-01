'use client'

import { usePOS } from './pos-provider'

const SHORTCUTS: Record<string, { key: string; label: string }[]> = {
  venda: [
    { key: 'F2', label: 'Buscar / Ler código' },
    { key: 'F4', label: 'Finalizar venda' },
    { key: '↑ / ↓', label: 'Selecionar item' },
    { key: '+ / -', label: 'Quantidade' },
    { key: 'Del', label: 'Remover item' },
    { key: 'Esc', label: 'Cancelar venda' },
  ],
  caixa: [
    { key: 'F2', label: 'Suprimento' },
    { key: 'F3', label: 'Sangria' },
  ],
  produtos: [{ key: 'F2', label: 'Novo produto' }],
  historico: [{ key: 'Enter', label: 'Ver detalhes' }],
  clientes: [{ key: 'F2', label: 'Novo cliente' }],
}

export function ShortcutsBar() {
  const { view } = usePOS()
  const items = SHORTCUTS[view] ?? []

  return (
    <footer className="flex h-10 shrink-0 items-center gap-4 overflow-x-auto border-t border-border bg-card px-5">
      {items.map((s) => (
        <div key={s.key} className="flex items-center gap-1.5 whitespace-nowrap text-xs">
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground">
            {s.key}
          </kbd>
          <span className="text-muted-foreground">{s.label}</span>
        </div>
      ))}
    </footer>
  )
}
