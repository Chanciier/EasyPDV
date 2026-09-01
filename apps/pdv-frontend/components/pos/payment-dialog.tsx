'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Banknote, CreditCard, Gift, QrCode, Trash2, Wallet } from 'lucide-react'
import type { Payment, PaymentCardBrand, PaymentCardType, PaymentMethod, Sale } from '@easypdv/shared-types'
import { Modal } from './ui/modal'
import { formatBRL } from '@/lib/pos-data'
import { ApiError } from '@/lib/api-client'
import { useRegisterPayment, useRemovePayment } from '@/hooks/use-sales'

/**
 * Fluxo em etapas (2026-09-01, pedido direto do usuário) — F4 abre direto na
 * seleção de forma de pagamento (nada mais na tela), escolher uma forma
 * (clique ou tecla numérica 1-5) avança pra tela de valor daquela perna;
 * `addLeg()` registra e, se ainda faltar pagar, volta sozinho pra seleção de
 * forma pra próxima perna — até `fullyPaid`, que aí mostra a tela de
 * confirmar (igual sempre foi). Reverte a decisão de 2026-08-21 de deixar
 * tudo numa tela só.
 *
 * Bandeira do cartão (removida, 2026-09-01, pedido direto do usuário) — a
 * escolha Mastercard/Visa (2026-08-21) virou passo a mais sem necessidade
 * real: `cardBrand` agora é sempre "mastercard" fixo pra qualquer
 * Crédito/Débito, sem pedir nada ao operador. O Bling continua recebendo
 * "mastercard" (resolvePaymentMethodId bate pelo nome exato "Crédito
 * (Mastercard)"/"Débito (Mastercard)", sem mudança nenhuma lá) — cartões
 * Visa passam a sair como Mastercard nos relatórios, decisão deliberada do
 * usuário (loja não precisa distinguir bandeira, só queria tirar a etapa).
 */
type MethodKey = 'dinheiro' | 'credito' | 'debito' | 'pix' | 'vale_troca'
type Step = 'method' | 'amount'

const METHODS: { key: MethodKey; label: string; icon: typeof Banknote; num: string }[] = [
  { key: 'dinheiro', label: 'Dinheiro', icon: Banknote, num: '1' },
  { key: 'credito', label: 'Crédito', icon: CreditCard, num: '2' },
  { key: 'debito', label: 'Débito', icon: Wallet, num: '3' },
  { key: 'pix', label: 'PIX', icon: QrCode, num: '4' },
  { key: 'vale_troca', label: 'Vale-Troca', icon: Gift, num: '5' },
]

const FIXED_CARD_BRAND: PaymentCardBrand = 'mastercard'

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  pix: 'PIX',
  vale_troca: 'Vale-Troca',
  outro: 'Outro',
}

const BRAND_LABELS: Record<PaymentCardBrand, string> = {
  mastercard: 'Mastercard',
  visa: 'Visa',
}

function paymentDisplayLabel(payment: Payment): string {
  if (!payment.cardType) return PAYMENT_LABELS[payment.method]
  const tipo = payment.cardType === 'credito' ? 'Crédito' : 'Débito'
  const bandeira = payment.cardBrand ? BRAND_LABELS[payment.cardBrand] : null
  const parcelas = payment.installments && payment.installments > 1 ? ` ${payment.installments}x` : ''
  return bandeira ? `${tipo} (${bandeira})${parcelas}` : `${tipo}${parcelas}`
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
  onClose,
  onPaymentRegistered,
  onConfirm,
}: {
  open: boolean
  sale: Sale | null | undefined
  /** Submitting/error aqui são só da confirmação FINAL (confirmar venda) — cada perna de pagamento tem seu próprio estado, gerenciado internamente. */
  submitting?: boolean
  error?: string | null
  onClose: () => void
  /** Disparado logo após cada perna ser registrada com sucesso — `received` é o valor recebido em dinheiro (não persistido), usado só pra montar o cupom/recibo depois. */
  onPaymentRegistered?: (payment: Payment, received: number) => void
  /** CPF (2026-08-25) já foi anexado no início da venda, antes do pagamento — ver CpfGateDialog em sale-view.tsx. */
  onConfirm: () => void
}) {
  const registerPayment = useRegisterPayment()
  const removePayment = useRemovePayment()

  const [step, setStep] = useState<Step>('method')
  const [selectedKey, setSelectedKey] = useState<MethodKey>('dinheiro')
  const [amount, setAmount] = useState('')
  const [received, setReceived] = useState('')
  const [installments, setInstallments] = useState(1)
  const [addError, setAddError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const isCard = selectedKey === 'credito' || selectedKey === 'debito'
  const method: PaymentMethod = isCard ? 'cartao' : selectedKey
  const cardType: PaymentCardType | null = selectedKey === 'credito' ? 'credito' : selectedKey === 'debito' ? 'debito' : null

  const total = sale?.totalAmount ?? 0
  const approvedPayments = useMemo(() => (sale?.payments ?? []).filter((p) => p.status === 'aprovado'), [sale?.payments])
  const approvedTotal = useMemo(() => approvedPayments.reduce((sum, p) => sum + p.amount, 0), [approvedPayments])
  const remaining = Math.max(0, Math.round((total - approvedTotal) * 100) / 100)
  const fullyPaid = remaining <= 0

  useEffect(() => {
    if (open) {
      setStep('method')
      setSelectedKey('dinheiro')
      setInstallments(1)
      setAddError(null)
    }
  }, [open])

  // Reseta os campos da perna atual sempre que o restante mudar (perna
  // adicionada ou removida) — o valor sugerido acompanha o que ainda falta.
  useEffect(() => {
    setAmount(remaining > 0 ? remaining.toFixed(2).replace('.', ',') : '')
    setReceived('')
    if (open && step === 'amount' && remaining > 0) setTimeout(() => inputRef.current?.focus(), 50)
  }, [remaining, open, step])

  /** Escolher uma forma (clique ou tecla numérica) já avança pra tela de valor — não é só um destaque visual. */
  function selectMethod(key: MethodKey) {
    setSelectedKey(key)
    setInstallments(1)
    setAddError(null)
    setStep('amount')
  }

  const isCash = selectedKey === 'dinheiro'
  const amountNum = Number(amount.replace(',', '.')) || 0
  const receivedNum = Number(received.replace(',', '.')) || 0
  const appliedAmount = Math.round((isCash ? Math.min(receivedNum, remaining) : amountNum) * 100) / 100
  const change = isCash ? Math.max(0, Math.round((receivedNum - remaining) * 100) / 100) : 0

  const canAddLeg =
    !fullyPaid &&
    !registerPayment.isPending &&
    appliedAmount > 0 &&
    appliedAmount <= remaining + 0.001 &&
    (isCash ? receivedNum > 0 : amountNum > 0 && amountNum <= remaining + 0.001)

  const canConfirm = fullyPaid && !submitting

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
        cardBrand: isCard ? FIXED_CARD_BRAND : null,
        installments: isCard ? installments : null,
      })
      const newPayment = updated.payments.find((p) => !sale.payments.some((existing) => existing.id === p.id))
      if (newPayment) {
        onPaymentRegistered?.(newPayment, receivedForThisLeg)
      }
      // Ainda falta pagar: volta sozinho pra seleção de forma, pra próxima
      // perna. Cobriu o total: não faz nada aqui — `fullyPaid` (derivado da
      // Sale já atualizada) assume o render sozinho, mostrando a tela de
      // confirmar. Calculado em cima da Sale que voltou da mutation (não de
      // `remaining`/`approvedTotal` do closure) — mesmo raciocínio do resto
      // do arquivo: nunca confiar num total calculado só localmente.
      const updatedApprovedTotal = updated.payments
        .filter((p) => p.status === 'aprovado')
        .reduce((sum, p) => sum + p.amount, 0)
      const newRemaining = Math.max(0, Math.round((updated.totalAmount - updatedApprovedTotal) * 100) / 100)
      if (newRemaining > 0) {
        setStep('method')
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
    onConfirm()
  }

  /** Esc no passo de valor volta pra seleção de forma (corrigir escolha errada) em vez de fechar o diálogo inteiro — só fecha de verdade na seleção ou já com tudo pago. */
  function handleClose() {
    if (step === 'amount' && !fullyPaid) {
      setStep('method')
      setAddError(null)
      return
    }
    onClose()
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      const found = METHODS.find((m) => m.num === e.key)
      if (found && document.activeElement?.tagName !== 'INPUT') {
        selectMethod(found.key)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        if (fullyPaid) confirm()
        else if (step === 'amount') void addLeg()
        else selectMethod(selectedKey)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step, selectedKey, amount, received, fullyPaid, canAddLeg, canConfirm, installments])

  const quickValues = [remaining, 20, 50, 100, 200].filter((v, i, a) => v > 0 && a.indexOf(v) === i)

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Pagamento"
      footer={
        fullyPaid ? (
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
              {submitting ? 'Confirmando…' : 'Confirmar venda (Enter)'}
            </button>
          </>
        ) : step === 'amount' ? (
          <>
            <button
              onClick={() => setStep('method')}
              disabled={registerPayment.isPending}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              Voltar (Esc)
            </button>
            <button
              onClick={() => void addLeg()}
              disabled={!canAddLeg}
              className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {registerPayment.isPending ? 'Adicionando…' : 'Adicionar pagamento (Enter)'}
            </button>
          </>
        ) : (
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
          >
            Cancelar (Esc)
          </button>
        )
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
                <span>{paymentDisplayLabel(p)}</span>
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

        {!fullyPaid && step === 'method' && (
          <div>
            <p className="mb-2 text-sm font-medium">Forma de pagamento</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {METHODS.map((m) => {
                const Icon = m.icon
                return (
                  <button
                    key={m.key}
                    onClick={() => selectMethod(m.key)}
                    className="flex flex-col items-center gap-1.5 rounded-lg border-2 border-border bg-card px-2 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                  >
                    <Icon className="size-5" />
                    {m.label}
                    <kbd className="rounded bg-muted px-1 font-mono text-[10px]">{m.num}</kbd>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {!fullyPaid && step === 'amount' && (
          <>
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              {(() => {
                const m = METHODS.find((x) => x.key === selectedKey)!
                const Icon = m.icon
                return (
                  <>
                    <Icon className="size-4" />
                    {m.label}
                  </>
                )
              })()}
            </div>

            {isCard && (
              <div className="space-y-3">
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

            {(selectedKey === 'pix' || selectedKey === 'vale_troca') && (
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
