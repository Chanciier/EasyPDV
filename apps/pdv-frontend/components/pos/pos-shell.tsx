'use client'

import { useEffect, useState } from 'react'
import {
  ShoppingCart,
  Wallet,
  Package,
  Receipt,
  Users,
  ScanBarcode,
  Lock,
  Unlock,
  LogOut,
  Settings,
  ShieldCheck,
  BarChart3,
  UserCog,
  WifiOff,
  AlertTriangle,
} from 'lucide-react'
import type { UserRole } from '@easypdv/shared-types'
import { usePOS } from './pos-provider'
import { formatBRL } from '@/lib/pos-data'
import { useAuthStore } from '@/lib/auth-store'
import { useCurrentCashSession } from '@/hooks/use-cash'
import { useRealtime } from '@/hooks/use-realtime'
import { useSyncStatus } from '@/hooks/use-sync'
import { SaleView } from './sale-view'
import { CashView } from './cash-view'
import { ProductsView } from './products-view'
import { HistoryView } from './history-view'
import { CustomersView } from './customers-view'
import { AuditView } from './audit-view'
import { ReportsView } from './reports-view'
import { AdminView } from './admin-view'
import { ShortcutsBar } from './shortcuts-bar'
import { SettingsDialog } from './settings-dialog'

const NAV = [
  { key: 'venda', label: 'Venda', icon: ShoppingCart, hint: 'F1' },
  { key: 'caixa', label: 'Caixa', icon: Wallet, hint: 'F6' },
  { key: 'produtos', label: 'Produtos', icon: Package, hint: 'F7' },
  { key: 'historico', label: 'Histórico', icon: Receipt, hint: 'F8' },
  { key: 'clientes', label: 'Clientes', icon: Users, hint: 'F9' },
] as const

const AUDIT_NAV = { key: 'auditoria', label: 'Auditoria', icon: ShieldCheck, hint: 'F2' } as const
const AUDIT_ROLES: UserRole[] = ['administrador', 'gerente', 'auditor']

const REPORTS_NAV = { key: 'relatorios', label: 'Relatórios', icon: BarChart3, hint: 'F5' } as const
const REPORTS_ROLES: UserRole[] = ['administrador', 'gerente', 'proprietario']

const ADMIN_NAV = { key: 'administracao', label: 'Administração', icon: UserCog, hint: 'F3' } as const
const ADMIN_ROLES: UserRole[] = ['administrador']

export function POSShell() {
  useRealtime()
  const { view, setView } = usePOS()
  const { data: cashSession } = useCurrentCashSession()
  const { data: syncStatus } = useSyncStatus()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.clear)
  const [today, setToday] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const canSeeAudit = !!user && AUDIT_ROLES.includes(user.role)
  const canSeeReports = !!user && REPORTS_ROLES.includes(user.role)
  const canSeeAdmin = !!user && ADMIN_ROLES.includes(user.role)
  const visibleNav = [
    ...NAV,
    ...(canSeeReports ? [REPORTS_NAV] : []),
    ...(canSeeAudit ? [AUDIT_NAV] : []),
    ...(canSeeAdmin ? [ADMIN_NAV] : []),
  ]

  useEffect(() => {
    setToday(
      new Date().toLocaleDateString('pt-BR', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
      }),
    )
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, (typeof visibleNav)[number]['key']> = {
        F1: 'venda',
        F6: 'caixa',
        F7: 'produtos',
        F8: 'historico',
        F9: 'clientes',
        ...(canSeeReports ? { F5: 'relatorios' } : {}),
        ...(canSeeAudit ? { F2: 'auditoria' } : {}),
        ...(canSeeAdmin ? { F3: 'administracao' } : {}),
      }
      const target = map[e.key]
      if (target) {
        e.preventDefault()
        setView(target)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setView, canSeeAudit, canSeeReports, canSeeAdmin])

  const cashOpen = cashSession?.status === 'open'

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <aside className="flex w-56 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <ScanBarcode className="size-5" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-tight">PDV Express</p>
            <p className="text-xs text-sidebar-foreground/60">Ponto de Venda</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3">
          {visibleNav.map((item) => {
            const Icon = item.icon
            const active = view === item.key
            return (
              <button
                key={item.key}
                onClick={() => setView(item.key)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="size-4.5 shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                <kbd
                  className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                    active
                      ? 'bg-sidebar-primary-foreground/15 text-sidebar-primary-foreground'
                      : 'bg-sidebar-accent text-sidebar-foreground/60'
                  }`}
                >
                  {item.hint}
                </kbd>
              </button>
            )
          })}
        </nav>

        <div className="border-t border-sidebar-border px-4 py-3 text-xs">
          <div className="flex items-center gap-2">
            {cashOpen ? (
              <Unlock className="size-3.5 text-primary" />
            ) : (
              <Lock className="size-3.5 text-sidebar-foreground/50" />
            )}
            <span className={cashOpen ? 'text-primary' : 'text-sidebar-foreground/60'}>
              Caixa {cashOpen ? 'aberto' : 'fechado'}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="truncate text-sidebar-foreground/50">{user?.name}</p>
            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={() => setSettingsOpen(true)}
                title="Configurações"
                className="rounded p-1 text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <Settings className="size-3.5" />
              </button>
              <button
                onClick={logout}
                title="Sair"
                className="rounded p-1 text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <LogOut className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-5">
          <h1 className="text-lg font-semibold capitalize">
            {visibleNav.find((n) => n.key === view)?.label}
          </h1>
          <div className="flex items-center gap-4 text-sm">
            {syncStatus && syncStatus.failedCount > 0 ? (
              <span className="flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">
                <AlertTriangle className="size-3.5" />
                Falha de sincronização ({syncStatus.failedCount})
              </span>
            ) : syncStatus && syncStatus.pendingCount > 0 ? (
              <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                <WifiOff className="size-3.5" />
                Sincronização pendente ({syncStatus.pendingCount})
              </span>
            ) : null}
            <span className="text-muted-foreground" suppressHydrationWarning>
              {today}
            </span>
            <span className="hidden items-center gap-1.5 rounded-full bg-muted px-3 py-1 sm:flex">
              <Wallet className="size-3.5 text-muted-foreground" />
              <span className="font-mono font-medium">
                {formatBRL(cashSession?.openingAmount ?? 0)}
              </span>
            </span>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-hidden">
          {view === 'venda' && <SaleView />}
          {view === 'caixa' && <CashView />}
          {view === 'produtos' && <ProductsView />}
          {view === 'historico' && <HistoryView />}
          {view === 'clientes' && <CustomersView />}
          {view === 'relatorios' && canSeeReports && <ReportsView />}
          {view === 'auditoria' && canSeeAudit && <AuditView />}
          {view === 'administracao' && canSeeAdmin && <AdminView />}
        </main>

        <ShortcutsBar />
      </div>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
