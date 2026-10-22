'use client'

import { useMemo, useState } from 'react'
import { Search, Receipt, TrendingUp, Hash, CheckCircle2, Clock3, AlertCircle, Ban, ExternalLink } from 'lucide-react'
import type { FiscalDocument, Sale, UserRole } from '@easypdv/shared-types'
import { formatCpf, onlyDigits } from '@easypdv/shared-validation'
import { formatBRL, normalize } from '@/lib/pos-data'
import { isElectron } from '@/hooks/use-hardware'
import { ApiError, describeError } from '@/lib/api-client'
import { PAYMENT_LABELS, paymentLabel } from '@/lib/payment-labels'
import { useAuthStore } from '@/lib/auth-store'
import { useFiscalStatus, useIssueFiscalReceipt, useProducts, useReissueFiscalReceipt, useRetryFiscalReceipt, useSalesList, useVoidSale } from '@/hooks/use-sales'
import { useDashboardReport } from '@/hooks/use-reports'
import { useCustomer } from '@/hooks/use-customers'
import { usePrintReceipt } from '@/hooks/use-hardware'
import { useFiscalPrintStore } from '@/lib/fiscal-print-store'
import { Modal } from './ui/modal'
import { StatCard } from './ui/stat-card'

// RolesGuard (backend) já libera "proprietario" pra tudo desde 2026-09-16 —
// sem ele aqui, o dono da loja não via o botão "Estornar venda" (mesmo gap
// já corrigido em cash-view.tsx, achado real de produção, 2026-09-17).
const VOID_ROLES: UserRole[] = ['administrador', 'gerente', 'proprietario']

/**
 * CPF sempre mascarado no Histórico e no estorno (ajuste do sign-off,
 * 2026-10-22): a tela fica à vista do cliente na frente do caixa.
 */
function maskCpf(document: string | null | undefined): string | null {
  const d = onlyDigits(document ?? '')
  if (d.length !== 11) return null
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`
}

/** Soma das pernas de Vale-Troca aprovadas — o que o estorno devolve ao saldo do cliente (K6). */
function storeCreditUsed(sale: Sale): number {
  return sale.payments
    .filter((p) => p.status === 'aprovado' && p.method === 'vale_troca')
    .reduce((sum, p) => sum + p.amount, 0)
}

function formatTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'
}

type VoidNotice = { saleId: string; status: 'refunded' | 'pending'; amount: number }

const FISCAL_STATUS_META: Record<
  FiscalDocument['status'],
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  pending: { label: 'NFC-e pendente', icon: Clock3, className: 'bg-muted text-muted-foreground' },
  issued: { label: 'NFC-e emitida', icon: CheckCircle2, className: 'bg-primary/15 text-primary-foreground' },
  cancelled: { label: 'NFC-e cancelada', icon: Ban, className: 'bg-muted text-muted-foreground' },
  error: { label: 'Erro na NFC-e', icon: AlertCircle, className: 'bg-destructive/10 text-destructive' },
}

function FiscalStatusBadge({ saleId }: { saleId: string }) {
  // 'pending-only' (PERF-07): emissão manual (botão "Emitir cupom fiscal")
  // deixa o status "pending" por alguns segundos (SEFAZ é assíncrono) — só
  // nesse caso repete; sem documento ou já resolvido, não fica consultando.
  const { data: fiscal } = useFiscalStatus(saleId, { poll: 'pending-only' })
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
          title="Abre no navegador"
        >
          DANFE ↗
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


export function HistoryView() {
  // K3/F6: `finalizedOnly` tira do Histórico os rascunhos abandonados
  // ("Reiniciar venda"), que antes apareciam como "Cancelada" e ocupavam o
  // limite de 100. O filtro local cobre um backend que ainda não conheça o
  // parâmetro.
  const { data: rawSales = [], isLoading } = useSalesList({
    status: ['confirmed', 'cancelled'],
    finalizedOnly: true,
  })
  const sales = useMemo(() => rawSales.filter((s) => s.confirmedAt !== null), [rawSales])
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
  const [voidNotice, setVoidNotice] = useState<VoidNotice | null>(null)
  const [printError, setPrintError] = useState<string | null>(null)
  const issueFiscalReceipt = useIssueFiscalReceipt()
  const retryFiscalReceipt = useRetryFiscalReceipt()
  const reissueFiscalReceipt = useReissueFiscalReceipt()
  const setPendingFiscalPrint = useFiscalPrintStore((s) => s.setPending)
  // 'pending-only' (PERF-07): só repete enquanto a NFC-e está "pending"
  // (emissão manual em andamento); para em null e nos estados finais.
  const { data: detailFiscal } = useFiscalStatus(detail?.id ?? null, { poll: 'pending-only' })
  const { data: detailCustomer } = useCustomer(detail?.customerId ?? null)

  function openDetail(sale: Sale) {
    setDetail(sale)
    setVoidOpen(false)
    setVoidReason('')
    setVoidError(null)
    setPrintError(null)
  }

  /**
   * Estorno (F-2/F-4, K6 — 2026-10-22). Se a venda usou Vale-Troca, o backend
   * estorna localmente e depois devolve o saldo na central; o resultado
   * (`storeCreditRefund`) fica visível — o modal NÃO fecha sozinho nesse caso,
   * e quando a devolução fica "pending" o aviso de ajuste manual permanece
   * também no topo da tela até o operador dispensar.
   */
  async function handleVoidSale() {
    // Enter repetido enquanto o estorno ainda roda não dispara um segundo pedido.
    if (!detail || voidSale.isPending) return
    if (!voidReason.trim()) {
      setVoidError('Informe o motivo do estorno.')
      return
    }
    setVoidError(null)
    try {
      const result = await voidSale.mutateAsync({ saleId: detail.id, reason: voidReason.trim() })
      setVoidOpen(false)
      setVoidReason('')
      if (result.storeCreditRefund) {
        const { storeCreditRefund, ...voided } = result
        setDetail(voided)
        setVoidNotice({ saleId: detail.id, status: storeCreditRefund.status, amount: storeCreditRefund.amount })
      } else {
        setDetail(null)
      }
    } catch (e) {
      setVoidError(describeError(e, 'Erro ao estornar venda.'))
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
      // 2ª via igual ao cupom original (CPF completo, como a NFC-e); a máscara é só na tela.
      customerDocument: detailCustomer?.document ? formatCpf(detailCustomer.document) : undefined,
    }
  }

  /**
   * Reimpressão na térmica (UX-13, 2026-10-22): sempre disponível pra venda
   * confirmada — antes só aparecia com status fiscal "issued", então com a
   * central fora ou NFC-e pendente não dava nem pra reimprimir o comprovante.
   * O bloco fiscal (QR/chave) só entra com NFC-e emitida e os 3 campos.
   */
  function handlePrint() {
    if (!detail) return
    setPrintError(null)
    const basePayload = buildPrintBasePayload(detail)
    const fiscal =
      detailFiscal?.type === 'nfce' && detailFiscal.status === 'issued' ? detailFiscal : null
    const payload =
      fiscal?.documentNumber && fiscal.accessKey && fiscal.qrCodeUrl
        ? {
            ...basePayload,
            fiscal: { documentNumber: fiscal.documentNumber, accessKey: fiscal.accessKey, qrCodeUrl: fiscal.qrCodeUrl },
          }
        : basePayload
    printReceipt.mutate(payload, {
      onError: (e) => setPrintError(`${describeError(e, 'Não foi possível imprimir.')} Confira a impressora.`),
    })
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

  /**
   * Reemissão (2026-09-16) — pra quando "Tentar novamente" não resolve (ex:
   * rejeição por emissão atrasada, que só piora a cada reenvio). Ver
   * docblock de useReissueFiscalReceipt.
   */
  function handleReissueFiscal() {
    if (!detail) return
    setPendingFiscalPrint({ saleId: detail.id, basePayload: buildPrintBasePayload(detail) })
    reissueFiscalReceipt.mutate(detail.id)
  }

  /** UX-12: busca também por valor ("45,90") e hora ("14:3"), que é como o operador procura. */
  const filtered = useMemo(() => {
    const t = normalize(term)
    if (!t) return sales
    return sales.filter((s) => {
      const labels = s.payments.map((p) => PAYMENT_LABELS[p.method]).join(' ')
      return (
        normalize(s.id).includes(t) ||
        normalize(labels).includes(t) ||
        normalize(formatBRL(s.totalAmount)).includes(t) ||
        formatTime(s.confirmedAt).includes(t)
      )
    })
  }, [term, sales])

  const detailHasIssuedNfce = detailFiscal?.type === 'nfce' && detailFiscal.status === 'issued'
  const detailStoreCredit = detail ? storeCreditUsed(detail) : 0
  const detailCpfMasked = maskCpf(detailCustomer?.document)

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
          autoFocus
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && filtered[0]) {
              e.preventDefault()
              openDetail(filtered[0])
            }
          }}
          placeholder="Buscar por valor, hora, cupom ou forma de pagamento — Enter abre o primeiro"
          className="h-10 w-full bg-transparent text-sm outline-none"
          aria-label="Buscar venda"
        />
      </div>

      {voidNotice && (
        <VoidNoticeBanner notice={voidNotice} onDismiss={() => setVoidNotice(null)} className="mb-4" />
      )}

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
                  {s.customerId ? 'CPF ✓' : 'Consumidor Final'}
                </span>
                <span className="text-muted-foreground">
                  {s.payments[0] ? PAYMENT_LABELS[s.payments[0].method] : '—'}
                </span>
                <span className="text-muted-foreground">{formatTime(s.confirmedAt)}</span>
                <span>
                  {s.status === 'cancelled' ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-destructive">
                      <Ban className="size-3.5" />
                      Estornada
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
              {canVoid && detail?.status === 'confirmed' && !detailHasIssuedNfce && (
                <button
                  onClick={() => setVoidOpen(true)}
                  className="rounded-lg px-4 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                >
                  Estornar venda
                </button>
              )}
              {detailFiscal?.type === 'comprovante_nao_fiscal' && (
                <button
                  onClick={handleIssueFiscal}
                  disabled={issueFiscalReceipt.isPending}
                  title="Emite uma NFC-e de verdade pra Consumidor Final, sem CPF"
                  className="rounded-lg border border-primary-foreground/40 px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {issueFiscalReceipt.isPending ? 'Emitindo…' : 'Emitir cupom fiscal'}
                </button>
              )}
              {detailFiscal?.type === 'nfce' && detailFiscal?.status === 'error' && (
                <button
                  onClick={handleRetryFiscal}
                  disabled={retryFiscalReceipt.isPending || reissueFiscalReceipt.isPending}
                  title="Reenvia a NFC-e rejeitada pra SEFAZ"
                  className="rounded-lg border border-primary-foreground/40 px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {retryFiscalReceipt.isPending ? 'Reenviando…' : 'Tentar novamente'}
                </button>
              )}
              {detailFiscal?.type === 'nfce' && detailFiscal?.status === 'error' && (
                <button
                  onClick={handleReissueFiscal}
                  disabled={retryFiscalReceipt.isPending || reissueFiscalReceipt.isPending}
                  title="Descarta essa NFC-e e emite uma nova, com data de emissão atual — use se 'Tentar novamente' continuar rejeitando"
                  className="rounded-lg border border-primary-foreground/40 px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {reissueFiscalReceipt.isPending ? 'Emitindo…' : 'Emitir nova NFC-e'}
                </button>
              )}
              <button
                onClick={() => window.print()}
                title="Imprime esta tela pela impressora do Windows"
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
              >
                Imprimir tela
              </button>
              {detail?.status === 'confirmed' && isElectron() && (
                <button
                  onClick={handlePrint}
                  disabled={printReceipt.isPending}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {printReceipt.isPending ? 'Imprimindo…' : detailHasIssuedNfce ? 'Imprimir cupom fiscal' : 'Imprimir cupom'}
                </button>
              )}
            </>
          )
        }
      >
        {detail && (
          <div className="space-y-3 font-mono text-sm">
            <div className="flex justify-between gap-3 text-muted-foreground">
              <span>{detail.confirmedAt ? new Date(detail.confirmedAt).toLocaleString('pt-BR') : '—'}</span>
              <span className="truncate text-right">
                {detail.customerId
                  ? [detailCustomer?.name, detailCpfMasked ? `CPF ${detailCpfMasked}` : null].filter(Boolean).join(' · ') ||
                    'Cliente identificado'
                  : 'Consumidor Final'}
              </span>
            </div>
            <FiscalStatusBadge saleId={detail.id} />
            {detail.status === 'cancelled' && (
              <div className="flex items-center gap-1.5 font-sans text-sm font-medium text-destructive">
                <Ban className="size-4" />
                Venda estornada
              </div>
            )}
            {canVoid && detail.status === 'confirmed' && detailHasIssuedNfce && (
              <div className="rounded-lg bg-muted px-3 py-2 font-sans text-sm text-muted-foreground">
                NFC-e já autorizada — o cancelamento precisa ser feito no Bling.
              </div>
            )}
            {voidOpen && detailStoreCredit > 0 && (
              <div className="rounded-lg bg-primary/15 px-3 py-2 font-sans text-sm text-primary-foreground">
                Esta venda usou <strong>{formatBRL(detailStoreCredit)} de Vale-Troca</strong>
                {detailCpfMasked ? ` (CPF ${detailCpfMasked})` : ''}. O estorno devolve esse valor ao saldo do
                cliente.
              </div>
            )}
            {voidNotice && voidNotice.saleId === detail.id && (
              <VoidNoticeBanner notice={voidNotice} />
            )}
            {printError && (
              <div className="rounded-lg bg-destructive/10 px-3 py-2 font-sans text-xs text-destructive">
                {printError}
              </div>
            )}
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
            {reissueFiscalReceipt.isError && (
              <div className="rounded-lg bg-destructive/10 px-3 py-2 font-sans text-xs text-destructive">
                {reissueFiscalReceipt.error instanceof ApiError
                  ? reissueFiscalReceipt.error.code
                  : 'Erro ao emitir nova NFC-e. Tente de novo em alguns instantes.'}
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

/** Resultado da devolução de Vale-Troca no estorno (K6). "pending" fica até o operador dispensar. */
function VoidNoticeBanner({
  notice,
  onDismiss,
  className = '',
}: {
  notice: VoidNotice
  onDismiss?: () => void
  className?: string
}) {
  const ok = notice.status === 'refunded'
  return (
    <div
      role="alert"
      className={`flex items-start justify-between gap-3 rounded-lg px-3 py-2 font-sans text-sm ${
        ok ? 'bg-primary/15 text-primary-foreground' : 'bg-destructive/10 text-destructive'
      } ${className}`}
    >
      <span>
        {ok
          ? `Venda estornada. ${formatBRL(notice.amount)} devolvidos ao Vale-Troca do cliente.`
          : `Venda estornada, mas o Vale-Troca de ${formatBRL(notice.amount)} não pôde ser devolvido agora (sem conexão com a central). Ajuste o saldo manualmente em Clientes: +${formatBRL(notice.amount)}, motivo "Estorno da venda ${notice.saleId}".`}
      </span>
      {onDismiss && (
        <button onClick={onDismiss} className="shrink-0 text-xs underline">
          Ok
        </button>
      )}
    </div>
  )
}
