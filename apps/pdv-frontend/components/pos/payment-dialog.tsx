'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Banknote, CreditCard, QrCode, HelpCircle } from 'lucide-react'
import type { PaymentCardType, PaymentMethod } from '@easypdv/shared-types'
import { formatCpf, isValidCpf, onlyDigits } from '@easypdv/shared-validation'
import { Modal } from './ui/modal'
import { formatBRL } from '@/lib/pos-data'

const METHODS: { key: PaymentMethod; label: string; icon: typeof Banknote; num: string }[] = [
  { key: 'dinheiro', label: 'Dinheiro', icon: Banknote, num: '1' },
  { key: 'cartao', label: 'Cartão', icon: CreditCard, num: '2' },
  { key: 'pix', label: 'PIX', icon: QrCode, num: '3' },
  { key: 'outro', label: 'Outro', icon: HelpCircle, num: '4' },
]

const CARD_TYPES: { key: PaymentCardType; label: string }[] = [
  { key: 'credito', label: 'Crédito' },
  { key: 'debito', label: 'Débito' },
]

export function PaymentDialog({
  open,
  total,
  submitting = false,
  error = null,
  showCpfField = false,
  onClose,
  onConfirm,
}: {
  open: boolean
  total: number
  submitting?: boolean
  error?: string | null
  /** Só mostra o campo "CPF na nota" se a venda ainda não tem cliente anexado (evita conflito com o seletor de cliente de antes dos itens). */
  showCpfField?: boolean
  onClose: () => void
  onConfirm: (
    method: PaymentMethod,
    received: number,
    cardType: PaymentCardType | null,
    installments: number | null,
    cpf: string | null,
  ) => void
}) {
  const [method, setMethod] = useState<PaymentMethod>('dinheiro')
  const [received, setReceived] = useState<string>('')
  const [cardType, setCardType] = useState<PaymentCardType>('credito')
  const [installments, setInstallments] = useState(1)
  const [cpf, setCpf] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setMethod('dinheiro')
      setReceived('')
      setCardType('credito')
      setInstallments(1)
      setCpf('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const receivedNum = Number(received.replace(',', '.')) || 0
  const change = useMemo(() => Math.max(0, receivedNum - total), [receivedNum, total])
  const isCash = method === 'dinheiro'
  const isCard = method === 'cartao'
  const cpfDigits = onlyDigits(cpf)
  const cpfIsValid = cpfDigits.length === 0 || isValidCpf(cpfDigits)
  const canConfirm = !submitting && (!isCash || receivedNum >= total) && cpfIsValid

  const confirm = () => {
    if (!canConfirm) return
    onConfirm(
      method,
      isCash ? receivedNum : total,
      isCard ? cardType : null,
      isCard ? installments : null,
      cpfDigits.length > 0 ? cpfDigits : null,
    )
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      const found = METHODS.find((m) => m.num === e.key)
      if (found && document.activeElement?.tagName !== 'INPUT') {
        setMethod(found.key)
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        confirm()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, method, received, canConfirm, cardType, installments])

  const quickValues = [total, 20, 50, 100, 200].filter((v, i, a) => a.indexOf(v) === i)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Pagamento"
      footer={
        <>
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancelar (Esc)
          </button>
          <button
            onClick={confirm}
            disabled={!canConfirm}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? 'Confirmando…' : 'Confirmar (Enter)'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="rounded-xl bg-primary/15 px-5 py-4 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Total a pagar
          </p>
          <p className="mt-1 font-mono text-4xl font-bold text-foreground">{formatBRL(total)}</p>
        </div>

        {showCpfField && (
          <div>
            <label htmlFor="cpf-na-nota" className="mb-1.5 block text-sm font-medium">
              CPF na nota <span className="font-normal text-muted-foreground">(opcional)</span>
            </label>
            <input
              id="cpf-na-nota"
              value={cpf}
              onChange={(e) => setCpf(formatCpf(onlyDigits(e.target.value).slice(0, 11)))}
              disabled={submitting}
              placeholder="000.000.000-00"
              inputMode="numeric"
              className={`w-full rounded-lg border bg-background px-4 py-2.5 font-mono text-sm outline-none focus:ring-2 focus:ring-ring/40 disabled:opacity-50 ${
                cpfIsValid ? 'border-input focus:border-primary' : 'border-destructive focus:border-destructive'
              }`}
            />
            {!cpfIsValid && <p className="mt-1 text-xs text-destructive">CPF inválido.</p>}
          </div>
        )}

        <div>
          <p className="mb-2 text-sm font-medium">Forma de pagamento</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {METHODS.map((m) => {
              const Icon = m.icon
              const active = method === m.key
              return (
                <button
                  key={m.key}
                  onClick={() => setMethod(m.key)}
                  disabled={submitting}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border-2 px-2 py-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    active
                      ? 'border-primary bg-primary/15 text-foreground'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  <Icon className="size-5" />
                  {m.label}
                  <kbd className="rounded bg-muted px-1 font-mono text-[10px]">{m.num}</kbd>
                </button>
              )
            })}
          </div>
        </div>

        {isCard && (
          <div className="space-y-3">
            <div>
              <p className="mb-1.5 text-sm font-medium">Tipo</p>
              <div className="grid grid-cols-2 gap-2">
                {CARD_TYPES.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setCardType(c.key)}
                    disabled={submitting}
                    className={`rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      cardType === c.key
                        ? 'border-primary bg-primary/15 text-foreground'
                        : 'border-border bg-card text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="installments" className="mb-1.5 block text-sm font-medium">
                Parcelas
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setInstallments((n) => Math.max(1, n - 1))}
                  disabled={submitting || installments <= 1}
                  className="grid size-9 place-items-center rounded-md bg-muted text-foreground transition-colors hover:bg-border disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Diminuir parcelas"
                >
                  −
                </button>
                <input
                  id="installments"
                  type="number"
                  min={1}
                  max={12}
                  value={installments}
                  onChange={(e) => setInstallments(Math.min(12, Math.max(1, Number(e.target.value) || 1)))}
                  disabled={submitting}
                  className="h-9 w-16 rounded-md border border-input bg-background text-center font-mono text-sm outline-none focus:border-primary disabled:opacity-50"
                />
                <button
                  onClick={() => setInstallments((n) => Math.min(12, n + 1))}
                  disabled={submitting || installments >= 12}
                  className="grid size-9 place-items-center rounded-md bg-muted text-foreground transition-colors hover:bg-border disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Aumentar parcelas"
                >
                  +
                </button>
                <span className="text-sm text-muted-foreground">
                  {installments}x de {formatBRL(total / installments)}
                </span>
              </div>
            </div>
          </div>
        )}

        {isCash && (
          <div className="space-y-3">
            <div>
              <label htmlFor="received" className="mb-1.5 block text-sm font-medium">
                Valor recebido
              </label>
              <input
                id="received"
                ref={inputRef}
                inputMode="decimal"
                value={received}
                onChange={(e) => setReceived(e.target.value)}
                disabled={submitting}
                placeholder="0,00"
                className="w-full rounded-lg border border-input bg-background px-4 py-3 font-mono text-2xl font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-ring/40 disabled:opacity-50"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {quickValues.map((v, i) => (
                <button
                  key={i}
                  onClick={() => setReceived(String(v.toFixed(2)))}
                  disabled={submitting}
                  className="rounded-lg border border-border bg-secondary px-3 py-1.5 font-mono text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {i === 0 ? 'Exato' : formatBRL(v)}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3">
              <span className="text-sm font-medium text-muted-foreground">Troco</span>
              <span className="font-mono text-xl font-bold text-foreground">
                {formatBRL(change)}
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>
    </Modal>
  )
}
