'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, Plus, Minus, Trash2, ShoppingCart, Lock } from 'lucide-react'
import type { Payment, PaymentMethod, Product, ReceiptPrintPayload, Sale, SaleItem } from '@easypdv/shared-types'
import { formatBRL } from '@/lib/pos-data'
import { ApiError } from '@/lib/api-client'
import { useCartStore } from '@/lib/cart-store'
import { useFiscalPrintStore } from '@/lib/fiscal-print-store'
import { useCurrentCashSession } from '@/hooks/use-cash'
import { useCustomer } from '@/hooks/use-customers'
import { useHardwareSettings, useOpenDrawer, usePrintReceipt } from '@/hooks/use-hardware'
import {
  findProductByBarcode,
  useAddSaleItem,
  useApplyClubDiscount,
  useApplySaleDiscount,
  useAttachCustomer,
  useCancelSale,
  useConfirmSale,
  useProductPrices,
  useProductSearch,
  useProducts,
  useRemoveSaleItem,
  useSale,
  useStartSale,
} from '@/hooks/use-sales'
import { formatCpf } from '@easypdv/shared-validation'
import { CpfGateDialog } from './cpf-gate-dialog'
import { PaymentDialog } from './payment-dialog'
import { ReceiptDialog } from './receipt-dialog'

type Receipt = { sale: Sale; changeTotal: number }

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

/** Pagamento dividido + bandeira (2026-08-21) — usado no cupom/recibo pra identificar cada perna (ex: "Crédito (Mastercard) 3x"). */
function paymentLegLabel(payment: Payment): string {
  if (!payment.cardType) return PAYMENT_LABELS[payment.method]
  const tipo = payment.cardType === 'credito' ? 'Crédito' : 'Débito'
  const bandeira = payment.cardBrand ? BRAND_LABELS[payment.cardBrand] : null
  const parcelas = payment.installments && payment.installments > 1 ? ` ${payment.installments}x` : ''
  return bandeira ? `${tipo} (${bandeira})${parcelas}` : `${tipo}${parcelas}`
}

export function SaleView() {
  const { data: cashSession } = useCurrentCashSession()
  const cashOpen = cashSession?.status === 'open'

  const { saleId, selectedProductId, setSaleId, setSelectedProductId, reset } = useCartStore()
  const { data: sale } = useSale(saleId)
  const { data: saleCustomer } = useCustomer(sale?.customerId ?? null)

  const startSale = useStartSale()
  const addItem = useAddSaleItem()
  const removeItemMut = useRemoveSaleItem()
  const confirmSale = useConfirmSale()
  const attachCustomer = useAttachCustomer()
  const applyClubDiscount = useApplyClubDiscount()
  const cancelSale = useCancelSale()
  const applyDiscount = useApplySaleDiscount()
  const { data: hardwareSettings } = useHardwareSettings()
  const printReceipt = usePrintReceipt()
  const openDrawer = useOpenDrawer()

  const [term, setTerm] = useState('')
  const [debouncedTerm, setDebouncedTerm] = useState('')
  const [highlight, setHighlight] = useState(0)
  const [adding, setAdding] = useState(false)
  const [pendingProductId, setPendingProductId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paymentSubmitting, setPaymentSubmitting] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  // Pagamento dividido (2026-08-21) — "recebido" (pra calcular troco) só
  // existe na tela, nunca é persistido (Payment guarda só `amount`, o valor
  // efetivamente aplicado). Populado por PaymentDialog a cada perna em
  // dinheiro registrada, lido de volta ao montar o recibo/cupom.
  const [receivedByPaymentId, setReceivedByPaymentId] = useState<Record<string, number>>({})
  const [discountOpen, setDiscountOpen] = useState(false)
  const [discountValue, setDiscountValue] = useState('')
  const [discountError, setDiscountError] = useState<string | null>(null)
  // CPF no início da venda (2026-08-25) — ver CpfGateDialog. `gateSubmitting`/
  // `gateError` cobrem só o passo de iniciar a venda em si; falha ao anexar
  // CPF/checar clube DEPOIS da venda já criada nunca bloqueia (mostrado no
  // banner de erro normal da tela, a venda já existe e pode seguir).
  const [gateSubmitting, setGateSubmitting] = useState(false)
  const [gateError, setGateError] = useState<string | null>(null)
  const [clubNotice, setClubNotice] = useState<'member' | 'non-member' | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  // "Imprimir nota no momento da venda" (2026-08-21) — a NFC-e emite em
  // segundo plano (passa pelo Bling de forma assíncrona), então "no
  // momento da venda" na prática é "assim que ficar pronta, sem precisar
  // ir no Histórico". O acompanhamento em si mora fora desta tela (ver
  // lib/fiscal-print-store.ts) — precisa sobreviver à troca de aba.
  const setPendingFiscalPrint = useFiscalPrintStore((s) => s.setPending)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedTerm(term), 250)
    return () => clearTimeout(t)
  }, [term])

  const { data: searchResults = [] } = useProductSearch(debouncedTerm)

  const matches = useMemo(() => searchResults.slice(0, 6), [searchResults])
  const priceQueries = useProductPrices(matches.map((p) => p.id))

  const itemProductIds = useMemo(() => sale?.items.map((i) => i.productId) ?? [], [sale])
  // Inclui os itens do último cupom também: reset() já limpou o saleId do
  // carrinho no momento em que o ReceiptDialog é exibido, então sale.items
  // sozinho não cobre mais os produtos daquela venda confirmada.
  const receiptProductIds = useMemo(
    () => receipt?.sale.items.map((i) => i.productId) ?? [],
    [receipt],
  )
  const allProductIds = useMemo(
    () => Array.from(new Set([...itemProductIds, ...receiptProductIds])),
    [itemProductIds, receiptProductIds],
  )
  const productQueries = useProducts(allProductIds)
  const productNames = useMemo(() => {
    const map: Record<string, string> = {}
    allProductIds.forEach((id, idx) => {
      const name = productQueries[idx]?.data?.name
      if (name) map[id] = name
    })
    return map
  }, [allProductIds, productQueries])

  const describeError = (e: unknown, fallback: string) => {
    if (e instanceof ApiError) return e.code
    if (e instanceof Error) return e.message
    return fallback
  }

  async function handleApplyDiscount() {
    if (!sale) return
    const amount = Number(discountValue.replace(',', '.'))
    if (Number.isNaN(amount) || amount < 0) {
      setDiscountError('Valor inválido.')
      return
    }
    setDiscountError(null)
    try {
      await applyDiscount.mutateAsync({ saleId: sale.id, discountAmount: amount })
      setDiscountOpen(false)
    } catch (e) {
      setDiscountError(describeError(e, 'Erro ao aplicar desconto.'))
    }
  }

  /**
   * A venda em si só existe depois do CpfGateDialog resolver (ver render
   * abaixo — a busca/carrinho só ficam visíveis quando `sale` já existe),
   * então isso é só uma checagem defensiva, não cria mais a venda de forma
   * lazy no primeiro item como antes (2026-08-25).
   */
  function ensureSale(): Sale {
    if (!sale) {
      throw new Error('Inicie a venda informando o CPF (ou "sem CPF") antes de adicionar itens.')
    }
    return sale
  }

  /**
   * CPF no início da venda (2026-08-25, reverte a captura no fechamento do
   * pagamento) — chamado pelo CpfGateDialog. Cria a venda, e se um CPF foi
   * informado, anexa o cliente e checa/aplica o desconto de clube na hora,
   * ANTES de qualquer item entrar no carrinho — resolve de vez o caso de
   * borda de "pagamento já registrado quando descobre que é clube".
   */
  async function startSaleWithDocument(document: string | null) {
    if (!cashSession || cashSession.status !== 'open') {
      setGateError('Abra o caixa antes de iniciar uma venda.')
      return
    }
    setGateSubmitting(true)
    setGateError(null)
    setClubNotice(null)
    try {
      const newSale = await startSale.mutateAsync({ cashSessionId: cashSession.id })
      setSaleId(newSale.id)
      if (document) {
        try {
          await attachCustomer.mutateAsync({ saleId: newSale.id, document })
          const withDiscount = await applyClubDiscount.mutateAsync({ saleId: newSale.id })
          setClubNotice(withDiscount.discountSource === 'club' ? 'member' : 'non-member')
        } catch (e) {
          // CPF/clube nunca bloqueia a venda em si — ela já foi criada e
          // pode seguir normalmente, só avisa via banner de erro comum.
          setError(describeError(e, 'Não foi possível vincular o CPF a essa venda.'))
        }
      }
    } catch (e) {
      setGateError(describeError(e, 'Erro ao iniciar a venda.'))
    } finally {
      setGateSubmitting(false)
    }
  }

  async function changeQty(currentSaleId: string, item: SaleItem, newQty: number) {
    setPendingProductId(item.productId)
    try {
      if (newQty <= 0) {
        await removeItemMut.mutateAsync({ saleId: currentSaleId, itemId: item.id })
        if (selectedProductId === item.productId) setSelectedProductId(null)
      } else {
        await removeItemMut.mutateAsync({ saleId: currentSaleId, itemId: item.id })
        await addItem.mutateAsync({ saleId: currentSaleId, productId: item.productId, quantity: newQty })
      }
    } catch (e) {
      setError(describeError(e, 'Erro ao atualizar quantidade.'))
    } finally {
      setPendingProductId(null)
    }
  }

  async function removeLine(item: SaleItem) {
    if (!sale) return
    setPendingProductId(item.productId)
    try {
      await removeItemMut.mutateAsync({ saleId: sale.id, itemId: item.id })
      if (selectedProductId === item.productId) setSelectedProductId(null)
    } catch (e) {
      setError(describeError(e, 'Erro ao remover item.'))
    } finally {
      setPendingProductId(null)
    }
  }

  async function addProduct(product: Product) {
    setError(null)
    setAdding(true)
    try {
      const currentSale = ensureSale()
      const existing = currentSale.items.find((i) => i.productId === product.id)
      if (existing) {
        await changeQty(currentSale.id, existing, existing.quantity + 1)
      } else {
        await addItem.mutateAsync({ saleId: currentSale.id, productId: product.id, quantity: 1 })
      }
      setSelectedProductId(product.id)
      setTerm('')
      setDebouncedTerm('')
      setHighlight(0)
      searchRef.current?.focus()
    } catch (e) {
      setError(describeError(e, 'Erro ao adicionar item.'))
    } finally {
      setAdding(false)
    }
  }

  const handleSearchKey = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, matches.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (e.nativeEvent.isComposing || e.keyCode === 229) return
      // `matches` vem de `debouncedTerm` (250ms atrás de `term`) — só confia
      // nele quando o debounce já alcançou o texto atual. Bug real
      // (2026-08-19): um leitor de código de barras USB digita + Enter bem
      // mais rápido que 250ms, então `matches`/`highlight` ainda refletiam a
      // ÚLTIMA busca por nome feita antes do scan (o React Query mantém
      // `data` do último resultado mesmo com a query desabilitada por termo
      // vazio) — todo código lido virava o primeiro item daquela busca
      // antiga, nunca o produto escaneado de verdade. Sem essa checagem de
      // frescor, o fallback de leitura exata (`findProductByBarcode`) logo
      // abaixo nunca era alcançado.
      const searchIsFresh = debouncedTerm === term.trim()
      if (searchIsFresh && matches[highlight]) {
        addProduct(matches[highlight])
      } else if (searchIsFresh && matches.length === 1) {
        addProduct(matches[0])
      } else if (term.trim()) {
        // Sem match por nome/SKU (ou busca desatualizada) — busca não indexa
        // código de barras, tenta leitura exata.
        setError(null)
        setAdding(true)
        try {
          const { product } = await findProductByBarcode(term.trim())
          await addProduct(product)
        } catch {
          setError('Produto não encontrado.')
        } finally {
          setAdding(false)
        }
      }
    } else if (e.key === 'Escape') {
      // Só consome o Escape se tiver texto pra limpar — campo já vazio deixa
      // borbulhar pro handler global (reinicia a venda, ver useEffect de
      // atalhos abaixo). Sem essa checagem, Esc nunca reiniciava a venda
      // enquanto o cursor estivesse na busca (autoFocus — o caso comum).
      if (term) {
        e.stopPropagation()
        setTerm('')
      }
    }
  }

  // Atalhos globais da tela de venda
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      const typing =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement

      if (e.key === 'F2') {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
        return
      }
      if (e.key === 'F4') {
        e.preventDefault()
        if (sale && sale.items.length > 0) setPaymentOpen(true)
        return
      }
      if (typing) return

      if (e.key === 'Escape') {
        if (sale) cancelSale.mutate(sale.id, { onSuccess: () => { reset(); setClubNotice(null) } })
      } else if (e.key === '+' || e.key === '=') {
        const item = sale?.items.find((i) => i.productId === selectedProductId)
        if (item && sale) changeQty(sale.id, item, item.quantity + 1)
      } else if (e.key === '-') {
        const item = sale?.items.find((i) => i.productId === selectedProductId)
        if (item && sale) changeQty(sale.id, item, item.quantity - 1)
      } else if (e.key === 'Delete') {
        const item = sale?.items.find((i) => i.productId === selectedProductId)
        if (item) removeLine(item)
      } else if (
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey &&
        !paymentOpen &&
        !receipt
      ) {
        // Leitor de código de barras USB (emulação de teclado): sem nenhum
        // input focado, o primeiro caractere digitado foca a busca e é
        // encaminhado pra não se perder — o restante do código + Enter
        // chega direto no input, reaproveitando o fallback de leitura
        // exata que já existe em handleSearchKey (findProductByBarcode).
        //
        // preventDefault() é essencial aqui: mover o foco pro input DENTRO
        // do handler de keydown faz o navegador aplicar a inserção nativa
        // de texto no elemento recém-focado (não no que originou o evento)
        // — sem isso, o primeiro caractere seria duplicado (confirmado
        // rodando de verdade: virava "77" em vez de "7").
        e.preventDefault()
        const char = e.key
        setTerm((prev) => prev + char)
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sale, selectedProductId, paymentOpen, receipt])

  /**
   * Pagamento dividido (2026-08-21) — pagamento(s) já foram registrados
   * individualmente por PaymentDialog antes de chegar aqui. CPF (2026-08-25)
   * já foi anexado no início da venda pelo CpfGateDialog — aqui só confirma.
   */
  const handleConfirmPayment = async () => {
    if (!sale) return
    setPaymentSubmitting(true)
    setPaymentError(null)
    try {
      const confirmed = await confirmSale.mutateAsync(sale.id)
      setPaymentOpen(false)

      const approvedPayments = confirmed.payments.filter((p) => p.status === 'aprovado')
      const changeTotal = approvedPayments.reduce((sum, p) => {
        const received = receivedByPaymentId[p.id] ?? p.amount
        return sum + Math.max(0, received - p.amount)
      }, 0)
      const customerDocument = saleCustomer?.document ? formatCpf(saleCustomer.document) : undefined
      setReceipt({ sale: confirmed, changeTotal })

      const printBasePayload: Omit<ReceiptPrintPayload, 'fiscal'> = {
        saleId: confirmed.id,
        confirmedAt: confirmed.confirmedAt ?? new Date().toISOString(),
        items: confirmed.items.map((item) => ({
          name: productNames[item.productId] ?? item.productId,
          quantity: item.quantity,
          totalAmount: item.totalAmount,
        })),
        totalAmount: confirmed.totalAmount,
        payments: approvedPayments.map((p) => ({
          label: paymentLegLabel(p),
          amount: p.amount,
          received: receivedByPaymentId[p.id],
          change: receivedByPaymentId[p.id] ? Math.max(0, receivedByPaymentId[p.id] - p.amount) : undefined,
        })),
        customerDocument,
      }

      // Impressão/gaveta nunca bloqueiam nem falham a venda — já foi
      // confirmada no backend antes daqui, hardware é sempre opcional.
      if (hardwareSettings?.autoPrintReceipt) {
        printReceipt.mutate(printBasePayload)
        // "Imprimir nota no momento da venda" — acompanha a NFC-e dessa
        // venda em segundo plano e imprime sozinho assim que ela ficar
        // pronta, mesmo que o operador saia desta tela antes disso (ver
        // components/pos/fiscal-print-watcher.tsx).
        setPendingFiscalPrint({ saleId: confirmed.id, basePayload: printBasePayload })
      }
      if (approvedPayments.some((p) => p.method === 'dinheiro') && hardwareSettings?.autoOpenDrawerOnCash) {
        openDrawer.mutate()
      }

      reset()
      setTerm('')
      setClubNotice(null)
      setReceivedByPaymentId({})
    } catch (e) {
      setPaymentError(describeError(e, 'Erro ao confirmar pagamento.'))
    } finally {
      setPaymentSubmitting(false)
    }
  }

  const items = sale?.items ?? []

  return (
    <div className="flex h-full min-h-0">
      {/* Coluna esquerda: busca + carrinho */}
      <section className="flex min-w-0 flex-1 flex-col p-4">
        {!cashOpen && (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-muted px-4 py-2.5 text-sm text-muted-foreground">
            <Lock className="size-4" />
            Abra o caixa antes de iniciar uma venda.
          </div>
        )}

        {error && (
          <div className="mb-3 rounded-lg bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            {error}
          </div>
        )}

        {clubNotice && (
          <div
            className={`mb-3 flex items-center justify-between gap-2 rounded-lg px-4 py-2.5 text-sm ${
              clubNotice === 'member' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            }`}
          >
            <span>
              {clubNotice === 'member'
                ? 'Cliente do Clube Saldão — 30% de desconto aplicado.'
                : 'Cliente não pertence ao Clube Saldão.'}
            </span>
            <button onClick={() => setClubNotice(null)} className="text-xs underline">
              Ok
            </button>
          </div>
        )}

        {cashOpen && !sale ? (
          <CpfGateDialog submitting={gateSubmitting} error={gateError} onSubmit={startSaleWithDocument} />
        ) : (
          <>
        {sale && (
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {saleCustomer?.document ? `CPF: ${formatCpf(saleCustomer.document)}` : 'Venda sem CPF'}
            </span>
            <button
              onClick={() =>
                cancelSale.mutate(sale.id, { onSuccess: () => { reset(); setClubNotice(null) } })
              }
              disabled={cancelSale.isPending}
              className="text-xs text-muted-foreground underline decoration-dotted transition-colors hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reiniciar venda (Esc)
            </button>
          </div>
        )}

        {/* Busca */}
        <div className="relative">
          <div className="flex items-center gap-2 rounded-xl border-2 border-primary/40 bg-card px-3 shadow-sm focus-within:border-primary">
            <Search className="size-5 text-muted-foreground" />
            <input
              ref={searchRef}
              autoFocus
              value={term}
              disabled={!cashOpen || adding}
              onChange={(e) => {
                setTerm(e.target.value)
                setHighlight(0)
              }}
              onKeyDown={handleSearchKey}
              placeholder="Leia o código de barras ou busque por nome / SKU  —  F2"
              className="h-12 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
              aria-label="Buscar produto"
            />
          </div>

          {term.trim().length > 0 && matches.length > 0 && (
            <ul className="absolute left-0 right-0 top-14 z-20 overflow-hidden rounded-xl border border-border bg-popover shadow-xl">
              {matches.map((p, i) => {
                const price = priceQueries[i]?.data
                return (
                <li key={p.id}>
                  <button
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => addProduct(p)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm ${
                      i === highlight ? 'bg-primary/15' : 'hover:bg-muted'
                    }`}
                  >
                    <span className="font-mono text-xs text-muted-foreground">{p.sku}</span>
                    <span className="flex-1 truncate font-medium">{p.name}</span>
                    <span className="font-mono font-semibold">
                      {price ? formatBRL(price.effectivePrice) : '…'}
                    </span>
                  </button>
                </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Carrinho */}
        <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
          <div className="grid grid-cols-[1fr_5rem_7rem_6rem_2.5rem] items-center gap-2 border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Produto</span>
            <span className="text-center">Qtd</span>
            <span className="text-right">Preço</span>
            <span className="text-right">Total</span>
            <span />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                <ShoppingCart className="size-10 opacity-30" />
                <p className="text-sm">Nenhum item. Leia um código ou busque (F2).</p>
              </div>
            ) : (
              items.map((item) => {
                const active = item.productId === selectedProductId
                const pending = pendingProductId === item.productId
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedProductId(item.productId)}
                    className={`grid cursor-pointer grid-cols-[1fr_5rem_7rem_6rem_2.5rem] items-center gap-2 border-l-2 px-4 py-2.5 text-sm transition-opacity ${
                      active ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-muted/50'
                    } ${pending ? 'opacity-50' : ''}`}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{productNames[item.productId] ?? '…'}</p>
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (sale) changeQty(sale.id, item, item.quantity - 1)
                        }}
                        disabled={pending}
                        className="grid size-6 place-items-center rounded-md bg-muted text-foreground transition-colors hover:bg-border disabled:cursor-not-allowed"
                        aria-label="Diminuir"
                      >
                        <Minus className="size-3" />
                      </button>
                      <span className="w-6 text-center font-mono font-semibold">{item.quantity}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (sale) changeQty(sale.id, item, item.quantity + 1)
                        }}
                        disabled={pending}
                        className="grid size-6 place-items-center rounded-md bg-muted text-foreground transition-colors hover:bg-border disabled:cursor-not-allowed"
                        aria-label="Aumentar"
                      >
                        <Plus className="size-3" />
                      </button>
                    </div>
                    <span className="text-right font-mono text-muted-foreground">
                      {formatBRL(item.unitPrice)}
                    </span>
                    <span className="text-right font-mono font-semibold">
                      {formatBRL(item.totalAmount)}
                    </span>
                    <div className="flex justify-end">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          removeLine(item)
                        }}
                        disabled={pending}
                        className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed"
                        aria-label="Remover"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
          </>
        )}
      </section>

      {/* Coluna direita: totais */}
      <aside className="flex w-80 shrink-0 flex-col gap-4 border-l border-border bg-card/50 p-4">
        {sale && items.length > 0 && (
          <div className="mt-auto rounded-xl bg-card p-3 shadow-sm ring-1 ring-border">
            {sale.discountSource === 'club' ? (
              <div className="flex w-full items-center justify-between text-sm">
                <span className="text-muted-foreground">Desconto Clube Saldão</span>
                <span className="font-mono font-medium text-primary">- {formatBRL(sale.discountAmount)}</span>
              </div>
            ) : discountOpen ? (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">Desconto (R$)</label>
                <div className="flex gap-2">
                  <input
                    autoFocus
                    inputMode="decimal"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleApplyDiscount()
                      } else if (e.key === 'Escape') {
                        e.stopPropagation()
                        setDiscountOpen(false)
                        setDiscountError(null)
                      }
                    }}
                    placeholder="0,00"
                    className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-primary"
                    aria-label="Valor do desconto"
                  />
                  <button
                    onClick={handleApplyDiscount}
                    disabled={applyDiscount.isPending}
                    className="shrink-0 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Aplicar
                  </button>
                </div>
                {discountError && <p className="text-xs text-destructive">{discountError}</p>}
              </div>
            ) : (
              <button
                onClick={() => {
                  setDiscountValue(sale.discountAmount > 0 ? String(sale.discountAmount) : '')
                  setDiscountError(null)
                  setDiscountOpen(true)
                }}
                className="flex w-full items-center justify-between text-sm"
              >
                <span className="text-muted-foreground">Desconto</span>
                <span className="font-mono font-medium">
                  {sale.discountAmount > 0 ? `- ${formatBRL(sale.discountAmount)}` : 'Adicionar'}
                </span>
              </button>
            )}
          </div>
        )}

        <div className={items.length === 0 || !sale ? 'mt-auto' : ''}>
          <div className="space-y-2 rounded-xl bg-card p-4 shadow-sm ring-1 ring-border">
            {sale && sale.discountAmount > 0 && (
              <div className="flex items-baseline justify-between text-xs text-muted-foreground">
                <span>Subtotal</span>
                <span className="font-mono">{formatBRL(sale.totalAmount + sale.discountAmount)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold">Total</span>
              <span className="font-mono text-3xl font-bold">{formatBRL(sale?.totalAmount ?? 0)}</span>
            </div>
            <p className="text-right text-xs text-muted-foreground">
              {items.reduce((s, i) => s + i.quantity, 0)} itens
            </p>
          </div>
        </div>

        <button
          onClick={() => items.length > 0 && setPaymentOpen(true)}
          disabled={items.length === 0}
          className="flex h-16 items-center justify-center gap-2 rounded-xl bg-accent text-lg font-bold text-accent-foreground shadow-lg transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Finalizar
          <kbd className="rounded bg-accent-foreground/20 px-2 py-0.5 font-mono text-sm">F4</kbd>
        </button>
      </aside>

      <PaymentDialog
        open={paymentOpen}
        sale={sale}
        submitting={paymentSubmitting}
        error={paymentError}
        onClose={() => {
          if (!paymentSubmitting) {
            setPaymentOpen(false)
            setPaymentError(null)
          }
        }}
        onPaymentRegistered={(payment, received) =>
          setReceivedByPaymentId((m) => ({ ...m, [payment.id]: received }))
        }
        onConfirm={handleConfirmPayment}
      />
      <ReceiptDialog
        sale={receipt?.sale ?? null}
        productNames={productNames}
        changeTotal={receipt?.changeTotal ?? 0}
        onClose={() => setReceipt(null)}
      />
    </div>
  )
}
