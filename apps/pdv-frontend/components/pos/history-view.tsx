'use client'

import { useMemo, useState } from 'react'
import { Search, Receipt, TrendingUp, Hash, CheckCircle2, Clock3, AlertCircle, Ban, ExternalLink } from 'lucide-react'
import type { FiscalDocument, Payment, PaymentMethod, Sale, UserRole } from '@easypdv/shared-types'
import { formatCpf } from '@easypdv/shared-validation'
import { formatBRL, normalize } from '@/lib/pos-data'
import { ApiError } from '@/lib/api-client'
import { useAuthStore } from '@/lib/auth-store'
import { useFiscalStatus, useIssueFiscalReceipt, useProducts, useRetryFiscalReceipt, useSalesList, useVoidSale } from '@/hooks/use-sales'
import { useDashboardReport } from '@/hooks/use-reports'
import { useCustomer } from '@/hooks/use-customers'
import { usePrintReceipt } from '@/hooks/use-hardware'
import { useFiscalPrintStore } from '@/lib/fiscal-print-store'
import { Modal } from './ui/modal'
import { StatCard } from './ui/stat-card'

const VOID_ROLES: UserRole[] = ['administrador', 'gerente']

const FISCAL_STATUS_META: Record<
  FiscalDocument['status'],
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  pending: { label: 'NFC-e pendente', icon: Clock3, className: 'bg-muted text-muted-foreground' },
  issued: { label: 'NFC-e emitida', icon: CheckCircle2, className: 'bg-primary/10 text-primary' },
  cancelled: { label: 'NFC-e cancelada', icon: Ban, className: 'bg-muted text-muted-foreground' },
  error: { label: 'Erro na NFC-e', icon: AlertCircle, className: 'bg-destructive/10 text-destructive' },
}

function FiscalStatusBadge({ saleId }: { saleId: string }) {
  // pollWhilePending: emissão manual (botão "Emitir cupom fiscal" abaixo)
  // pode deixar o status "pending" por alguns segundos (SEFAZ é assíncrono)
  // — sem isso a badge ficava presa até o operador fechar e reabrir o modal.
  const { data: fiscal } = useFiscalStatus(saleId, { pollWhilePending: true })
  if (!fiscal) return null

  // Venda sem CPF (2026-08-25): nunca vira NFC-e de verdade, só um
  // comprovante local marcado "issued" na hora (sem SEFAZ). Rótulo próprio
  // pra não parecer que uma nota fiscal real foi emitida.
  if (fiscal.type === 'comprovante_nao_fiscal') {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 font-sans text-xs font-medium text-muted-foreground">
        <Receipt className="size-3.5" />
        Comprovante não fiscal (venda sem CPF)
      </div>
    )
  }

  const meta = FISCAL_STATUS_META[fiscal.status]
  const Icon = meta.icon

  return (
    <div
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-sans text-xs font-medium ${meta.className}`}
    >
      <Icon className="size-3.5" />
      {meta.label}
      {fiscal.documentNumber && <span className="opacity-70">#{fiscal.documentNumber}</span>}
      {fiscal.status === 'issued' && fiscal.danfeUrl && (
        <a
          href={fiscal.danfeUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-0.5 underline underline-offset-2 hover:opacity-80"
          title="Ver DANFE"
        >
          DANFE
          <ExternalLink className="size-3" />
        </a>
      )}
      {fiscal.status === 'error' && fiscal.errorMessage && (
        <span className="truncate opacity-70" title={fiscal.errorMessage}>
          {fiscal.errorMessage}
        </span>
      )}
    </div>
  )
}

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  pix: 'PIX',
  vale_troca: 'Vale-Troca',
  outro: 'Outro',
}

const BRAND_LABELS: Record<string, string> = {
  mastercard: 'Mastercard',
  visa: 'Visa',
}

/** Bandeira do cartão (2026-08-21) — mesmo formato de payment-dialog.tsx/sale-view.tsx. */
function paymentLabel(payment: Payment): string {
  if (!payment.cardType) return PAYMENT_LABELS[payment.method]
  const tipo = payment.cardType === 'credito' ? 'Crédito' : 'Débito'
  const bandeira = payment.cardBrand ? BRAND_LABELS[payment.cardBrand] : null
  return bandeira ? `${tipo} (${bandeira})` : tipo
}

export function HistoryView() {
  const { data: sales = [], isLoading } = useSalesList({ status: ['confirmed', 'cancelled'] })
  const { data: dashboard } = useDashboardReport()
  const user = useAuthStore((s) => s.user)
  const canVoid = !!user && VOID_ROLES.includes(user.role)
  const voidSale = useVoidSale()
  const printReceipt = usePrintReceipt()
  const [term, setTerm] = useState('')
  const [detail, setDetail] = useState<Sale | null>(null)
  const [voidOpen, setVoidOpen] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [voidError, setVoidError] = useState<string | null>(null)
  const issueFiscalReceipt = useIssueFiscalReceipt()
  const retryFiscalReceipt = useRetryFiscalReceipt()
  const setPendingFiscalPrint = useFiscalPrintStore((s) => s.setPending)
  // pollWhilePending: emitir manualmente (handleIssueFiscal abaixo) deixa o
  // status "pending" por alguns segundos (SEFAZ é assíncrono) até virar
  // "issued"/"error" — sem isso a tela ficava presa no status antigo até o
  // operador fechar e reabrir o modal.
  const { data: detailFiscal } = useFiscalStatus(detail?.id ?? null, { pollWhilePending: true })
  const { data: detailCustomer } = useCustomer(detail?.customerId ?? null)

  function openDetail(sale: Sale) {
    setDetail(sale)
    setVoidOpen(false)
    setVoidReason('')
    setVoidError(null)
  }

  async function handleVoidSale() {
    if (!detail) return
    if (!voidReason.trim()) {
      setVoidError('Informe o motivo do estorno.')
      return
    }
    setVoidError(null)
    try {
      await voidSale.mutateAsync({ saleId: detail.id, reason: voidReason.trim() })
      setDetail(null)
      setVoidOpen(false)
      setVoidReason('')
    } catch (e) {
      setVoidError(e instanceof ApiError ? e.code : e instanceof Error ? e.message : 'Erro ao estornar venda.')
    }
  }

  /**
   * Cobre os dois tipos de `FiscalDocument` "issued" (venda com CPF = NFC-e
   * real, com QR; venda sem CPF = comprovante local, sem QR/chave — ver
   * `recordNonFiscalReceipt` no Intermediador). Antes desta função exigia os
   * três campos fiscais e simplesmente não fazia nada pra venda sem CPF — o
   * botão aparecia (status já vinha "issued" nesse caso) mas clicar não
   * imprimia nada, sem erro visível. `fiscal` já é opcional no payload
   * (ver `ReceiptPrintPayload`) exatamente pra cobrir esse caso.
   */
  function buildPrintBasePayload(sale: Sale) {
    return {
      saleId: sale.id,
      confirmedAt: sale.confirmedAt ?? new Date().toISOString(),
      items: sale.items.map((item) => ({
        name: detailProductNames[item.productId] ?? item.productId,
        quantity: item.quantity,
        totalAmount: item.totalAmount,
      })),
      totalAmount: sale.totalAmount,
      payments: sale.payments
        .filter((p) => p.status === 'aprovado')
        .map((p) => ({ label: paymentLabel(p), amount: p.amount })),
      customerDocument: detailCustomer?.document ? formatCpf(detailCustomer.document) : undefined,
    }
  }

  function handlePrint() {
    if (!detail || detailFiscal?.status !== 'issued') return
    const basePayload = buildPrintBasePayload(detail)
    const { documentNumber, accessKey, qrCodeUrl } = detailFiscal
    printReceipt.mutate(
      documentNumber && accessKey && qrCodeUrl
        ? { ...basePayload, fiscal: { documentNumber, accessKey, qrCodeUrl } }
        : basePayload,
    )
  }

  /**
   * Emissão manual de NFC-e (2026-08-26) — venda sem CPF só gera um
   * comprovante local por padrão (ver docblock de handlePrint acima). O
   * pedido de venda já existe no Bling (criado no sync original,
   * independente de CPF) — só falta gerar+enviar a NFC-e em cima dele, pra
   * "Consumidor Final" (CPF na nota sempre foi opcional). Registra a
   * impressão pendente no MESMO mecanismo já usado na hora da venda
   * (fiscal-print-store.ts) — o FiscalPrintWatcher, sempre montado em
   * pos-shell.tsx, imprime sozinho assim que a NFC-e sair, mesmo se o
   * operador fechar este modal ou trocar de aba antes disso.
   */
  function handleIssueFiscal() {
    if (!detail) return
    setPendingFiscalPrint({ saleId: detail.id, basePayload: buildPrintBasePayload(detail) })
    issueFiscalReceipt.mutate(detail.id)
  }

  /**
   * Reenvio manual de NFC-e rejeitada (2026-09-02) — mesmo mecanismo de
   * impressão pendente do handleIssueFiscal acima: se o reenvio funcionar,
   * o FiscalPrintWatcher imprime sozinho assim que virar "issued".
   */
  function handleRetryFiscal() {
    if (!detail) return
    setPendingFiscalPrint({ saleId: detail.id, basePayload: buildPrintBasePayload(detail) })
    retryFiscalReceipt.mutate(detail.id)
  }

  const filtered = useMemo(() => {
    const t = normalize(term)
    if (!t) return sales
    return sales.filter((s) => {
      const paymentLabel = s.payments[0] ? PAYMENT_LABELS[s.payments[0].method] : ''
      return normalize(s.id).includes(t) || normalize(paymentLabel).includes(t)
    })
  }, [term, sales])

  const detailProductIds = useMemo(() => detail?.items.map((i) => i.productId) ?? [], [detail])
  const detailProductQueries = useProducts(detailProductIds)
  const detailProductNames = useMemo(() => {
    const map: Record<string, string> = {}
    detailProductIds.forEach((id, idx) => {
      const name = detailProductQueries[idx]?.data?.name
      if (name) map[id] = name
    })
    return map
  }, [detailProductIds, detailProductQueries])

  return (
    <div className="flex h-full flex-col p-4">
      {/* Resumo do dia — agregado no banco (Sprint 13), sem o cap de 100
          registros que GET /sales tem, diferente da lista abaixo */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard icon={Hash} label="Vendas hoje" value={String(dashboard?.todaySalesCount ?? 0)} />
        <StatCard icon={TrendingUp} label="Total vendido hoje" value={formatBRL(dashboard?.todaySalesTotal ?? 0)} />
        <StatCard icon={Receipt} label="Ticket médio hoje" value={formatBRL(dashboard?.averageTicket ?? 0)} />
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-card px-3">
        <Search className="size-4 text-muted-foreground" />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar por cupom ou forma de pagamento"
          className="h-10 w-full bg-transparent text-sm outline-none"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid grid-cols-[10rem_1fr_9rem_8rem_7rem_7rem] items-center gap-3 border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Cupom</span>
          <span>Cliente</span>
          <span>Pagamento</span>
          <span>Hora</span>
          <span>Status</span>
          <span className="text-right">Total</span>
        </div>
        <div className="h-full overflow-y-auto pb-16">
          {!isLoading && filtered.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Receipt className="size-8 opacity-30" />
              <p className="text-sm">Nenhuma venda registrada ainda.</p>
            </div>
          ) : (
            filtered.map((s) => (
              <button
                key={s.id}
                onClick={() => openDetail(s)}
                className={`grid w-full grid-cols-[10rem_1fr_9rem_8rem_7rem_7rem] items-center gap-3 border-b border-border/60 px-4 py-2.5 text-left text-sm hover:bg-muted/50 ${s.status === 'cancelled' ? 'opacity-60' : ''}`}
              >
                <span className="truncate font-mono text-xs text-muted-foreground">{s.id}</span>
                <span className="truncate font-medium">
                  {s.customerId ?? 'Consumidor Final'}
                </span>
                <span className="text-muted-foreground">
                  {s.payments[0] ? PAYMENT_LABELS[s.payments[0].method] : '—'}
                </span>
                <span className="text-muted-foreground">
                  {s.confirmedAt
                    ? new Date(s.confirmedAt).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—'}
                </span>
                <span>
                  {s.status === 'cancelled' ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-destructive">
                      <Ban className="size-3.5" />
                      Cancelada
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Confirmada</span>
                  )}
                </span>
                <span className="text-right font-mono font-semibold">{formatBRL(s.totalAmount)}</span>
              </button>
            ))
          )}
        </div>
      </div>

      <Modal
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={`Cupom ${detail?.id ?? ''}`}
        footer={
          voidOpen ? (
            <div className="flex w-full items-center gap-2">
              <input
                autoFocus
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleVoidSale()
                  }
                }}
                placeholder="Motivo do estorno"
                className="h-9 flex-1 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-primary"
              />
              <button
                onClick={() => {
                  setVoidOpen(false)
                  setVoidError(null)
                }}
                disabled={voidSale.isPending}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                onClick={handleVoidSale}
                disabled={voidSale.isPending}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {voidSale.isPending ? 'Estornando…' : 'Confirmar estorno'}
              </button>
            </div>
          ) : (
            <>
              {canVoid && detail?.status !== 'cancelled' && (
                <button
                  onClick={() => setVoidOpen(true)}
                  className="rounded-lg px-4 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                >
                  Cancelar venda
                </button>
              )}
              {detailFiscal?.type === 'comprovante_nao_fiscal' && (
                <button
                  onClick={handleIssueFiscal}
                  disabled={issueFiscalReceipt.isPending}
                  title="Emite uma NFC-e de verdade pra Consumidor Final, sem CPF"
                  className="rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {issueFiscalReceipt.isPending ? 'Emitindo…' : 'Emitir cupom fiscal'}
                </button>
              )}
              {detailFiscal?.type === 'nfce' && detailFiscal?.status === 'error' && (
                <button
                  onClick={handleRetryFiscal}
                  disabled={retryFiscalReceipt.isPending}
                  title="Reenvia a NFC-e rejeitada pra SEFAZ"
                  className="rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {retryFiscalReceipt.isPending ? 'Reenviando…' : 'Tentar novamente'}
                </button>
              )}
              {detailFiscal?.status === 'issued' && (
                <button
                  onClick={handlePrint}
                  disabled={printReceipt.isPending}
                  className="rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {detailFiscal.type === 'comprovante_nao_fiscal' ? 'Imprimir cupom' : 'Imprimir cupom fiscal'}
                </button>
              )}
              <button
                onClick={() => window.print()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Reimprimir
              </button>
            </>
          )
        }
      >
        {detail && (
          <div className="space-y-3 font-mono text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>{detail.confirmedAt ? new Date(detail.confirmedAt).toLocaleString('pt-BR') : '—'}</span>
              <span>{detail.customerId ?? 'Consumidor Final'}</span>
            </div>
            <FiscalStatusBadge saleId={detail.id} />
            {voidError && (
              <div className="rounded-lg bg-destructive/10 px-3 py-2 font-sans text-xs text-destructive">
                {voidError}
              </div>
            )}
            {issueFiscalReceipt.isError && (
              <div className="rounded-lg bg-destructive/10 px-3 py-2 font-sans text-xs text-destructive">
                {issueFiscalReceipt.error instanceof ApiError
                  ? issueFiscalReceipt.error.code
                  : 'Erro ao emitir NFC-e. Tente de novo em alguns instantes.'}
              </div>
            )}
            {retryFiscalReceipt.isError && (
              <div className="rounded-lg bg-destructive/10 px-3 py-2 font-sans text-xs text-destructive">
                {retryFiscalReceipt.error instanceof ApiError
                  ? retryFiscalReceipt.error.code
                  : 'Erro ao reenviar NFC-e. Tente de novo em alguns instantes.'}
              </div>
            )}
            <div className="border-t border-dashed border-border" />
            {detail.items.map((i) => (
              <div key={i.id} className="flex justify-between">
                <span className="truncate pr-2">
                  {i.quantity}x {detailProductNames[i.productId] ?? '…'}
                </span>
                <span>{formatBRL(i.totalAmount)}</span>
              </div>
            ))}
            <div className="border-t border-dashed border-border" />
            <div className="flex justify-between text-base font-bold">
              <span>Total</span>
              <span>{formatBRL(detail.totalAmount)}</span>
            </div>
            {detail.payments.map((p) => (
              <div key={p.id} className="flex justify-between text-muted-foreground">
                <span>{paymentLabel(p)}</span>
                <span>{formatBRL(p.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
