'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  Lock,
  PlusCircle,
  MinusCircle,
} from 'lucide-react'
import type { CashMovementType } from '@easypdv/shared-types'
import { formatBRL } from '@/lib/pos-data'
import {
  useCashRegisters,
  useCashMovements,
  useCashSalesTotal,
  useCloseCashSession,
  useCurrentCashSession,
  useOpenCashSession,
  useRegisterCashMovement,
} from '@/hooks/use-cash'
import { Modal } from './ui/modal'

const MOV_LABEL: Record<CashMovementType, string> = {
  sangria: 'Sangria',
  suprimento: 'Suprimento',
  ajuste: 'Ajuste',
}

export function CashView() {
  const { data: cashSession, isLoading: loadingSession } = useCurrentCashSession()
  const { data: registers } = useCashRegisters()
  const { data: movements } = useCashMovements(cashSession?.id)
  const { data: cashSalesTotal = 0 } = useCashSalesTotal(cashSession?.id)
  const openMutation = useOpenCashSession()
  const closeMutation = useCloseCashSession(cashSession?.id)
  const movementMutation = useRegisterCashMovement(cashSession?.id)

  const [openAmount, setOpenAmount] = useState('')
  const [movType, setMovType] = useState<'suprimento' | 'sangria' | null>(null)
  const [movAmount, setMovAmount] = useState('')
  const [movNote, setMovNote] = useState('')
  const [closeModalOpen, setCloseModalOpen] = useState(false)
  const [countedAmount, setCountedAmount] = useState('')

  const isOpen = cashSession?.status === 'open'

  const totals = useMemo(() => {
    if (!cashSession) return { suprimentos: 0, sangrias: 0, saldo: 0 }
    let suprimentos = 0
    let sangrias = 0
    for (const m of movements ?? []) {
      if (m.type === 'suprimento') suprimentos += m.amount
      if (m.type === 'sangria') sangrias += m.amount
    }
    const saldo = cashSession.openingAmount + cashSalesTotal + suprimentos - sangrias
    return { suprimentos, sangrias, saldo }
  }, [cashSession, movements, cashSalesTotal])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      const typing =
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      if (typing) return
      if (e.key === 'F2') {
        e.preventDefault()
        setMovType('suprimento')
      } else if (e.key === 'F3') {
        e.preventDefault()
        setMovType('sangria')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen])

  const confirmMov = () => {
    const amount = Number(movAmount.replace(',', '.')) || 0
    if (amount <= 0 || !movType) return
    movementMutation.mutate(
      { type: movType, amount, reason: movNote || undefined },
      {
        onSuccess: () => {
          setMovType(null)
          setMovAmount('')
          setMovNote('')
        },
      },
    )
  }

  const openCash = () => {
    const registerId = registers?.[0]?.id
    if (!registerId) return
    openMutation.mutate({ cashRegisterId: registerId, openingAmount: Number(openAmount.replace(',', '.')) || 0 })
  }

  const confirmClose = () => {
    const closingAmount = Number(countedAmount.replace(',', '.')) || 0
    closeMutation.mutate(closingAmount, { onSuccess: () => setCloseModalOpen(false) })
  }

  if (loadingSession) {
    return <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">Carregando…</div>
  }

  if (!isOpen) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-primary/15">
            <Wallet className="size-7 text-primary-foreground" />
          </div>
          <h2 className="text-xl font-bold">Abrir caixa</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Informe o valor inicial (fundo de troco) para começar.
          </p>
          <input
            autoFocus
            inputMode="decimal"
            value={openAmount}
            onChange={(e) => setOpenAmount(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && openCash()}
            placeholder="R$ 0,00"
            className="mt-5 w-full rounded-lg border border-input bg-background px-4 py-3 text-center font-mono text-2xl font-bold outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
          />
          {openMutation.isError && (
            <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Não foi possível abrir o caixa. Tente novamente.
            </p>
          )}
          <button
            onClick={openCash}
            disabled={openMutation.isPending || !registers?.[0]}
            className="mt-4 w-full rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
          >
            {openMutation.isPending ? 'Abrindo...' : 'Abrir caixa'}
          </button>
        </div>
      </div>
    )
  }

  const cards = [
    { label: 'Abertura', value: cashSession.openingAmount, icon: Wallet, tone: 'text-foreground' },
    { label: 'Vendas (dinheiro)', value: cashSalesTotal, icon: ArrowUpCircle, tone: 'text-primary-foreground' },
    { label: 'Suprimentos', value: totals.suprimentos, icon: PlusCircle, tone: 'text-foreground' },
    { label: 'Sangrias', value: totals.sangrias, icon: MinusCircle, tone: 'text-accent' },
  ]

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon
          return (
            <div key={c.label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Icon className="size-4" />
                {c.label}
              </div>
              <p className="mt-2 font-mono text-2xl font-bold">{formatBRL(c.value)}</p>
            </div>
          )
        })}
      </div>

      {/* Saldo + ações */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-primary/15 px-6 py-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Saldo esperado em caixa
          </p>
          <p className="mt-1 font-mono text-4xl font-bold">{formatBRL(totals.saldo)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setMovType('suprimento')}
            className="flex items-center gap-2 rounded-lg bg-card px-4 py-2.5 text-sm font-semibold shadow-sm ring-1 ring-border transition-colors hover:bg-muted"
          >
            <PlusCircle className="size-4 text-primary-foreground" /> Suprimento
            <kbd className="rounded bg-muted px-1 font-mono text-[10px]">F2</kbd>
          </button>
          <button
            onClick={() => setMovType('sangria')}
            className="flex items-center gap-2 rounded-lg bg-card px-4 py-2.5 text-sm font-semibold shadow-sm ring-1 ring-border transition-colors hover:bg-muted"
          >
            <MinusCircle className="size-4 text-accent" /> Sangria
            <kbd className="rounded bg-muted px-1 font-mono text-[10px]">F3</kbd>
          </button>
          <button
            onClick={() => {
              setCountedAmount(totals.saldo.toFixed(2).replace('.', ','))
              setCloseModalOpen(true)
            }}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/90"
          >
            <Lock className="size-4" /> Fechar caixa
          </button>
        </div>
      </div>

      {/* Movimentações */}
      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold">
          Movimentações do caixa
        </div>
        <div className="divide-y divide-border overflow-y-auto">
          {(movements ?? []).length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhuma sangria ou suprimento registrado ainda.
            </p>
          )}
          {(movements ?? []).map((m) => {
            const negative = m.type === 'sangria'
            return (
              <div key={m.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                {negative ? (
                  <ArrowDownCircle className="size-4 text-accent" />
                ) : (
                  <ArrowUpCircle className="size-4 text-primary-foreground" />
                )}
                <span className="w-24 font-medium">{MOV_LABEL[m.type]}</span>
                <span className="flex-1 truncate text-muted-foreground">{m.reason}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(m.createdAt).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span
                  className={`w-28 text-right font-mono font-semibold ${
                    negative ? 'text-accent' : 'text-foreground'
                  }`}
                >
                  {negative ? '-' : '+'} {formatBRL(m.amount)}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <Modal
        open={movType !== null}
        onClose={() => setMovType(null)}
        title={movType === 'sangria' ? 'Sangria (retirada)' : 'Suprimento (entrada)'}
        size="sm"
        footer={
          <>
            <button
              onClick={() => setMovType(null)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              onClick={confirmMov}
              disabled={movementMutation.isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
            >
              {movementMutation.isPending ? 'Confirmando...' : 'Confirmar'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Valor</label>
            <input
              autoFocus
              inputMode="decimal"
              value={movAmount}
              onChange={(e) => setMovAmount(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmMov()}
              placeholder="R$ 0,00"
              className="w-full rounded-lg border border-input bg-background px-4 py-2.5 font-mono text-lg font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Observação</label>
            <input
              value={movNote}
              onChange={(e) => setMovNote(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmMov()}
              placeholder="Ex.: troco, retirada para banco..."
              className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={closeModalOpen}
        onClose={() => setCloseModalOpen(false)}
        title="Fechar caixa"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setCloseModalOpen(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              onClick={confirmClose}
              disabled={closeMutation.isPending}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/90 disabled:pointer-events-none disabled:opacity-50"
            >
              {closeMutation.isPending ? 'Fechando...' : 'Confirmar fechamento'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Saldo esperado: <span className="font-mono font-semibold text-foreground">{formatBRL(totals.saldo)}</span>
          </p>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Valor contado no caixa</label>
            <input
              autoFocus
              inputMode="decimal"
              value={countedAmount}
              onChange={(e) => setCountedAmount(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmClose()}
              placeholder="R$ 0,00"
              className="w-full rounded-lg border border-input bg-background px-4 py-2.5 font-mono text-lg font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
            />
          </div>
          {(() => {
            const counted = Number(countedAmount.replace(',', '.')) || 0
            const diff = counted - totals.saldo
            if (Math.abs(diff) < 0.005) return null
            return (
              <p className={`text-sm ${diff < 0 ? 'text-accent' : 'text-primary-foreground'}`}>
                {diff < 0 ? 'Falta' : 'Sobra'} {formatBRL(Math.abs(diff))} em relação ao esperado.
              </p>
            )
          })()}
        </div>
      </Modal>
    </div>
  )
}
