'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Banknote, CreditCard, QrCode, HelpCircle, Trash2 } from 'lucide-react'
import type { Payment, PaymentCardType, PaymentMethod, Sale } from '@easypdv/shared-types'
import { formatCpf, isValidCpf, onlyDigits } from '@easypdv/shared-validation'
import { Modal } from './ui/modal'
import { formatBRL } from '@/lib/pos-data'
import { ApiError } from '@/lib/api-client'
import { useRegisterPayment, useRemovePayment } from '@/hooks/use-sales'

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

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  pix: 'PIX',
  outro: 'Outro',
}

function describeError(e: unknown, fallback: string) {
  if (e instanceof ApiError) return e.code
  if (e instanceof Error) return e.message
  return fallback
}

/**
 * Pagamento dividido (2026-08-21): cada pagamento ("perna") é registrado no
 * backend IMEDIATAMENTE ao clicar "Adicionar" — nunca só no estado do React.
 * O restante a pagar sempre vem da `Sale` de verdade (prop, atualizada pelo
 * cache do React Query a cada registro/remoção), nunca de uma soma calculada
 * só localmente. Isso evita reabrir o bug real documentado em
 * register-payment.use-case.ts (retry de pagamento duplicando valor): se uma
 * perna falhar, nada foi perdido, o operador só tenta de novo aquela perna —
 * não existe um lote client-side pra ficar dessincronizado do servidor.
 * "Confirmar venda" só dispara a confirmação em si (sem dado de pagamento
 * nenhum — já está tudo salvo), igual ao fluxo de pagamento único de sempre.
 */
export function PaymentDialog({
  open,
  sale,
  submitting = false,
  error = null,
  showCpfField = false,
  onClose,
  onPaymentRegistered,
  onConfirm,
}: {
  open: boolean
  sale: Sale | null | undefined
  /** Submitting/error aqui são só da confirmação FINAL (anexar CPF + confirmar venda) — cada perna de pagamento tem seu próprio estado, gerenciado internamente. */
  submitting?: boolean
  error?: string | null
  /** Só mostra o campo "CPF na nota" se a venda ainda não tem cliente anexado (evita conflito com o seletor de cliente de antes dos itens). */
  showCpfField?: boolean
  onClose: () => void
  /** Disparado logo após cada perna ser registrada com sucesso — `received` é o valor recebido em dinheiro (não persistido), usado só pra montar o cupom/recibo depois. */
  onPaymentRegistered?: (payment: Payment, received: number) => void
  onConfirm: (cpf: string | null) => void
}) {
  const registerPayment = useRegisterPayment()
  const removePayment = useRemovePayment()

  const [method, setMethod] = useState<PaymentMethod>('dinheiro')
  const [amount, setAmount] = useState('')
  const [received, setReceived] = useState('')
  const [cardType, setCardType] = useState<PaymentCardType>('credito')
  const [installments, setInstallments] = useState(1)
  const [cpf, setCpf] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const total = sale?.totalAmount ?? 0
  const approvedPayments = useMemo(() => (sale?.payments ?? []).filter((p) => p.status === 'aprovado'), [sale?.payments])
  const approvedTotal = useMemo(() => approvedPayments.reduce((sum, p) => sum + p.amount, 0), [approvedPayments])
  const remaining = Math.max(0, Math.round((total - approvedTotal) * 100) / 100)
  const fullyPaid = remaining <= 0

  useEffect(() => {
    if (open) {
      setMethod('dinheiro')
      setCardType('credito')
      setInstallments(1)
      setCpf('')
      setAddError(null)
    }
  }, [open])

  // Reseta os campos da perna atual sempre que o restante mudar (perna
  // adicionada ou removida) — o valor sugerido acompanha o que ainda falta.
  useEffect(() => {
    setAmount(remaining > 0 ? remaining.toFixed(2).replace('.', ',') : '')
    setReceived('')
    if (open && remaining > 0) setTimeout(() => inputRef.current?.focus(), 50)
  }, [remaining, open])

  const isCash = method === 'dinheiro'
  const isCard = method === 'cartao'
  const amountNum = Number(amount.replace(',', '.')) || 0
  const receivedNum = Number(received.replace(',', '.')) || 0
  const appliedAmount = Math.round((isCash ? Math.min(receivedNum, remaining) : amountNum) * 100) / 100
  const change = isCash ? Math.max(0, Math.round((receivedNum - remaining) * 100) / 100) : 0
  const cpfDigits = onlyDigits(cpf)
  const cpfIsValid = cpfDigits.length === 0 || isValidCpf(cpfDigits)

  const canAddLeg =
    !fullyPaid &&
    !registerPayment.isPending &&
    appliedAmount > 0 &&
    appliedAmount <= remaining + 0.001 &&
    (isCash ? receivedNum > 0 : amountNum > 0 && amountNum <= remaining + 0.001)

  const canConfirm = fullyPaid && !submitting && cpfIsValid

  async function addLeg() {
    if (!sale || !canAddLeg) return
    setAddError(null)
    const receivedForThisLeg = isCash ? receivedNum : appliedAmount
    try {
      const updated = await registerPayment.mutateAsync({
        saleId: sale.id,
        method,
        amount: appliedAmount,
        cardType: isCard ? cardType : null,
        installments: isCard ? installments : null,
      })
      const newPayment = updated.payments.find((p) => !sale.payments.some((existing) => existing.id === p.id))
      if (newPayment) {
        onPaymentRegistered?.(newPayment, receivedForThisLeg)
      }
    } catch (e) {
      setAddError(describeError(e, 'Erro ao registrar pagamento.'))
    }
  }

  async function removeLeg(paymentId: string) {
    if (!sale) return
    setAddError(null)
    try {
      await removePayment.mutateAsync({ saleId: sale.id, paymentId })
    } catch (e) {
      setAddError(describeError(e, 'Erro ao remover pagamento.'))
    }
  }

  function confirm() {
    if (!canConfirm) return
    onConfirm(cpfDigits.length > 0 ? cpfDigits : null)
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
        if (fullyPaid) confirm()
        else void addLeg()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, method, amount, received, fullyPaid, canAddLeg, canConfirm, cardType, installments])

  const quickValues = [remaining, 20, 50, 100, 200].filter((v, i, a) => v > 0 && a.indexOf(v) === i)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Pagamento"
      footer={
        <>
          <button
            onClick={onClose}
            disabled={submitting || registerPayment.isPending || removePayment.isPending}
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancelar (Esc)
          </button>
          {fullyPaid ? (
            <button
              onClick={confirm}
              disabled={!canConfirm}
              className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? 'Confirmando…' : 'Confirmar venda (Enter)'}
            </button>
          ) : (
            <button
              onClick={() => void addLeg()}
              disabled={!canAddLeg}
              className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {registerPayment.isPending ? 'Adicionando…' : 'Adicionar pagamento (Enter)'}
            </button>
          )}
        </>
      }
    >
      <div className="space-y-5">
        <div className="rounded-xl bg-primary/15 px-5 py-4 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Total a pagar
          </p>
          <p className="mt-1 font-mono text-4xl font-bold text-foreground">{formatBRL(total)}</p>
          {approvedPayments.length > 0 && !fullyPaid && (
            <p className="mt-1 text-sm text-muted-foreground">
              Restante: <span className="font-mono font-semibold text-foreground">{formatBRL(remaining)}</span>
            </p>
          )}
        </div>

        {approvedPayments.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Pagamentos registrados</p>
            {approvedPayments.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm">
                <span>
                  {PAYMENT_LABELS[p.method]}
                  {p.cardType ? ` (${p.cardType === 'credito' ? 'crédito' : 'débito'}${p.installments && p.installments > 1 ? ` ${p.installments}x` : ''})` : ''}
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-mono font-medium">{formatBRL(p.amount)}</span>
                  <button
                    onClick={() => void removeLeg(p.id)}
                    disabled={removePayment.isPending}
                    aria-label="Remover pagamento"
                    className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}

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

        {!fullyPaid && (
          <>
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
                      disabled={registerPayment.isPending}
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
                        disabled={registerPayment.isPending}
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
                  <label htmlFor="card-amount" className="mb-1.5 block text-sm font-medium">
                    Valor desta perna
                  </label>
                  <input
                    id="card-amount"
                    ref={inputRef}
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={registerPayment.isPending}
                    placeholder="0,00"
                    className="w-full rounded-lg border border-input bg-background px-4 py-3 font-mono text-2xl font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-ring/40 disabled:opacity-50"
                  />
                  {amountNum > remaining + 0.001 && (
                    <p className="mt-1 text-xs text-destructive">Valor maior que o restante ({formatBRL(remaining)}).</p>
                  )}
                </div>
                <div>
                  <label htmlFor="installments" className="mb-1.5 block text-sm font-medium">
                    Parcelas
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setInstallments((n) => Math.max(1, n - 1))}
                      disabled={registerPayment.isPending || installments <= 1}
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
                      disabled={registerPayment.isPending}
                      className="h-9 w-16 rounded-md border border-input bg-background text-center font-mono text-sm outline-none focus:border-primary disabled:opacity-50"
                    />
                    <button
                      onClick={() => setInstallments((n) => Math.min(12, n + 1))}
                      disabled={registerPayment.isPending || installments >= 12}
                      className="grid size-9 place-items-center rounded-md bg-muted text-foreground transition-colors hover:bg-border disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Aumentar parcelas"
                    >
                      +
                    </button>
                    <span className="text-sm text-muted-foreground">
                      {installments}x de {formatBRL(amountNum / installments)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {!isCash && !isCard && (
              <div>
                <label htmlFor="other-amount" className="mb-1.5 block text-sm font-medium">
                  Valor desta perna
                </label>
                <input
                  id="other-amount"
                  ref={inputRef}
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={registerPayment.isPending}
                  placeholder="0,00"
                  className="w-full rounded-lg border border-input bg-background px-4 py-3 font-mono text-2xl font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-ring/40 disabled:opacity-50"
                />
                {amountNum > remaining + 0.001 && (
                  <p className="mt-1 text-xs text-destructive">Valor maior que o restante ({formatBRL(remaining)}).</p>
                )}
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
                    disabled={registerPayment.isPending}
                    placeholder="0,00"
                    className="w-full rounded-lg border border-input bg-background px-4 py-3 font-mono text-2xl font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-ring/40 disabled:opacity-50"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {quickValues.map((v, i) => (
                    <button
                      key={i}
                      onClick={() => setReceived(String(v.toFixed(2)))}
                      disabled={registerPayment.isPending}
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
          </>
        )}

        {(addError || error) && (
          <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {addError ?? error}
          </div>
        )}
      </div>
    </Modal>
  )
}
