'use client'

import { useState } from 'react'
import { AdminUsersTab } from './admin-users-tab'
import { AdminActivationTab } from './admin-activation-tab'

const TABS = [
  { key: 'usuarios', label: 'Usuários' },
  { key: 'ativacao', label: 'Ativar novo terminal' },
] as const

type TabKey = (typeof TABS)[number]['key']

export function AdminView() {
  const [tab, setTab] = useState<TabKey>('usuarios')

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-4 flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1">
        {tab === 'usuarios' && <AdminUsersTab />}
        {tab === 'ativacao' && <AdminActivationTab />}
      </div>
    </div>
  )
}
