'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Minus, Trash2, ShoppingCart, Lock, Percent, Gift, Wallet } from 'lucide-react'
import type { Product, ReceiptPrintPayload, Sale, SaleItem } from '@easypdv/shared-types'
import { formatBRL } from '@/lib/pos-data'
import { ApiError, describeError } from '@/lib/api-client'
import { paymentDisplayLabel } from '@/lib/payment-labels'
import { percentToAmount } from '@/lib/money'
import { readStoredSaleId, useCartStore, type ClubDecision } from '@/lib/cart-store'
import { useFiscalPrintStore } from '@/lib/fiscal-print-store'
import { useCurrentCashSession } from '@/hooks/use-cash'
import { useCustomer } from '@/hooks/use-customers'
import { isElectron, useHardwareSettings, useOpenDrawer, usePrintReceipt } from '@/hooks/use-hardware'
import {
  findProductByBarcode,
  useAddSaleItem,
  useApplyClubDiscount,
  useApplyItemDiscount,
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
  useUpdateSaleItemQuantity,
} from '@/hooks/use-sales'
import { useStoreCreditBalance } from '@/hooks/use-store-credit'
import { formatCpf } from '@easypdv/shared-validation'
import { CpfGateDialog } from './cpf-gate-dialog'
import { PaymentDialog } from './payment-dialog'
import { ReceiptDialog } from './receipt-dialog'
import { usePOS } from './pos-provider'

type PrintBasePayload = Omit<ReceiptPrintPayload, 'fiscal'>
type Receipt = { sale: Sale; changeTotal: number; printPayload: PrintBasePayload }

/** Desconto padrão do item de venda de sócio (30%) quando o operador não digita nada — ver `finalizeClubItemDiscount` em SaleView. */
const CLUB_DEFAULT_DISCOUNT_PERCENT = 30

/**
 * Clube Saldão — desconto por item (2026-09-02, pedido direto do usuário):
 * pausa depois de um único dígito 1-9 digitado, pra distinguir de um leitor
 * de código de barras USB (que manda vários dígitos + Enter em poucos
 * milissegundos). Curta o bastante pra não travar o operador, longa o
 * bastante pra nenhum leitor real terminar de mandar um código nesse tempo.
 */
const CLUB_DISCOUNT_DIGIT_DELAY_MS = 300

/** UX-05: janela do "Esc de novo pra cancelar" numa venda com itens/pagamentos. */
const CANCEL_CONFIRM_WINDOW_MS = 3000

const CPF_ATTACH_OFFLINE_MESSAGE =
  'Não foi possível consultar o CPF agora (sem conexão com a central). A venda segue sem CPF: sai só o comprovante e não tem desconto do Clube. Para tentar de novo, Reiniciar venda (Esc).'
const CLUB_CHECK_OFFLINE_MESSAGE =
  'Não foi possível consultar o Clube Saldão agora. A venda segue sem o desconto do Clube; para tentar de novo, Reiniciar venda (Esc).'

/** Erro que veio do backend com motivo de verdade (validação/domínio), não queda de rede/servidor. */
function isDomainError(e: unknown): boolean {
  return e instanceof ApiError && e.status < 500 && e.status !== 429
}

function isTypingTarget(el: Element | null): boolean {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement
}

export function SaleView() {
  const { setView } = usePOS()
  const queryClient = useQueryClient()
  const { data: cashSession } = useCurrentCashSession()
  const cashOpen = cashSession?.status === 'open'

  // Seletores (não o store inteiro): o store agora guarda decisões de clube e
  // recebidos — sem seletor, qualquer `set` re-renderizaria a tela toda.
  const saleId = useCartStore((s) => s.saleId)
  const selectedProductId = useCartStore((s) => s.selectedProductId)
  const setSaleId = useCartStore((s) => s.setSaleId)
  const setSelectedProductId = useCartStore((s) => s.setSelectedProductId)
  const setClubDecision = useCartStore((s) => s.setClubDecision)
  const setClubDecisions = useCartStore((s) => s.setClubDecisions)
  const forgetClubDecision = useCartStore((s) => s.forgetClubDecision)
  const setReceived = useCartStore((s) => s.setReceived)
  const reset = useCartStore((s) => s.reset)

  const { data: sale, error: saleError } = useSale(saleId)
  const { data: saleCustomer } = useCustomer(sale?.customerId ?? null)
  // Fase 3 (2026-09-10) — saldo de Vale-Troca visível assim que o CPF é
  // anexado à venda; validação de verdade acontece no payment-dialog.tsx.
  const { data: creditBalanceData } = useStoreCreditBalance(saleCustomer?.document ?? null)
  const creditBalance = creditBalanceData?.balance ?? null

  const startSale = useStartSale()
  const addItem = useAddSaleItem()
  const removeItemMut = useRemoveSaleItem()
  const updateQty = useUpdateSaleItemQuantity()
  const confirmSale = useConfirmSale()
  const attachCustomer = useAttachCustomer()
  const applyClubDiscount = useApplyClubDiscount()
  const cancelSale = useCancelSale()
  const applyDiscount = useApplySaleDiscount()
  const applyItemDiscount = useApplyItemDiscount()
  const { data: hardwareSettings } = useHardwareSettings()
  const printReceipt = usePrintReceipt()
  const openDrawer = useOpenDrawer()

  const [term, setTerm] = useState('')
  const [debouncedTerm, setDebouncedTerm] = useState('')
  const [highlight, setHighlight] = useState(0)
  const [busyCount, setBusyCount] = useState(0)
  const adding = busyCount > 0
  const [pendingProductId, setPendingProductId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paymentSubmitting, setPaymentSubmitting] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [printError, setPrintError] = useState<string | null>(null)
  const [discountOpen, setDiscountOpen] = useState(false)
  const [discountValue, setDiscountValue] = useState('')
  const [discountMode, setDiscountMode] = useState<'amount' | 'percent'>('amount')
  const [discountError, setDiscountError] = useState<string | null>(null)
  const [itemDiscountId, setItemDiscountId] = useState<string | null>(null)
  const [itemDiscountValue, setItemDiscountValue] = useState('')
  const [itemDiscountMode, setItemDiscountMode] = useState<'amount' | 'percent'>('amount')
  const [itemDiscountError, setItemDiscountError] = useState<string | null>(null)
  // CPF no início da venda (2026-08-25) — ver CpfGateDialog. `gateSubmitting`/
  // `gateError` cobrem só o passo de iniciar a venda em si; falha ao anexar
  // CPF/checar clube DEPOIS da venda já criada nunca bloqueia (mostrado no
  // banner de erro normal da tela, a venda já existe e pode seguir).
  const [gateSubmitting, setGateSubmitting] = useState(false)
  const [gateError, setGateError] = useState<string | null>(null)
  // Aviso do Clube: "sócio" é derivado da própria venda (sobrevive à troca de
  // aba); "não é sócio" só aparece logo depois da consulta.
  const [clubHintDismissed, setClubHintDismissed] = useState(false)
  const [nonMemberNotice, setNonMemberNotice] = useState(false)
  const [cancelArmed, setCancelArmed] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const cpfInputRef = useRef<HTMLInputElement>(null)
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

  /**
   * UX-18 (2026-10-22): o `saleId` fica em sessionStorage (ver cart-store),
   * então um Ctrl+R no meio da venda retoma o rascunho em vez de deixá-lo
   * órfão. `restoredSaleIdRef` marca que o id veio do storage e ainda precisa
   * ser validado (pode já ter sido confirmado/cancelado ou não existir mais).
   */
  const restoredSaleIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (useCartStore.getState().saleId) return
    const stored = readStoredSaleId()
    if (stored) {
      restoredSaleIdRef.current = stored
      setSaleId(stored)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * Validação do rascunho retomado. Decisões de clube não sobrevivem ao reload
   * (ux-revisao §2, regra 6): item que já tem desconto conta como decidido
   * (`fixed`, nunca é sobrescrito); item sem desconto volta a ser pendente e
   * cai nos 30% no próximo bipe de outro produto ou no F4.
   */
  useEffect(() => {
    const restored = restoredSaleIdRef.current
    if (!restored || restored !== saleId) return
    if (saleError) {
      restoredSaleIdRef.current = null
      reset()
      return
    }
    if (!sale) return
    restoredSaleIdRef.current = null
    if (sale.status !== 'draft' && sale.status !== 'pending') {
      reset()
      return
    }
    if (sale.discountSource === 'club') {
      const decided: Record<string, ClubDecision> = {}
      for (const item of sale.items) {
        if (item.discountAmount > 0) decided[item.productId] = { kind: 'fixed' }
      }
      setClubDecisions(decided)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sale, saleError, saleId])

  /**
   * Fila das mutações do carrinho (fusão F1, 2026-10-22). A busca não fica
   * mais `disabled` durante a adição (o foco saía do campo e o Enter do 2º
   * bipe se perdia), então dois bipes podem chegar com o 1º ainda em voo.
   * Tudo que mexe no carrinho (bipe, +/-, remover, descontos, cancelar) passa
   * por aqui, um de cada vez, e cada tarefa lê a venda mais recente do cache
   * (`latestSale`), nunca a do closure — sem linhas duplicadas e sem uma
   * resposta antiga sobrescrevendo a venda no cache.
   */
  const queueRef = useRef<Promise<unknown>>(Promise.resolve())
  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    setBusyCount((c) => c + 1)
    const run = queueRef.current.then(task)
    queueRef.current = run.catch(() => undefined)
    return run.finally(() => setBusyCount((c) => c - 1))
  }

  /** Enfileira e mostra o erro no banner da tela (nunca rejeita). */
  function runCartTask(task: () => Promise<void>, fallback: string): Promise<void> {
    return enqueue(task).catch((e) => setError(describeError(e, fallback)))
  }

  function latestSale(): Sale | undefined {
    const id = useCartStore.getState().saleId
    return id ? queryClient.getQueryData<Sale>(['sale', id]) : undefined
  }

  /**
   * `discountMode: 'percent'` (2026-09-01) é só uma conveniência de entrada
   * — converte pra R$ aqui antes de mandar pro backend, que continua só
   * conhecendo `discountAmount` em reais (mesmo contrato de sempre, sem
   * mudança de schema). Igual ao desconto em R$ já existente, fica um valor
   * FIXO no momento em que é aplicado — não recalcula sozinho se o carrinho
   * mudar depois (diferente do desconto de clube, que é sempre um
   * percentual vivo do subtotal atual).
   */
  async function handleApplyDiscount() {
    if (!sale) return
    const raw = Number(discountValue.replace(',', '.'))
    if (Number.isNaN(raw) || raw < 0) {
      setDiscountError('Valor inválido.')
      return
    }
    const subtotal = sale.totalAmount + sale.discountAmount
    const amount = discountMode === 'percent' ? percentToAmount(subtotal, raw) : raw
    setDiscountError(null)
    try {
      await enqueue(() => applyDiscount.mutateAsync({ saleId: sale.id, discountAmount: amount }))
      setDiscountOpen(false)
    } catch (e) {
      setDiscountError(describeError(e, 'Erro ao aplicar desconto.'))
    }
  }

  /**
   * Desconto por item (2026-09-01) — mesmo esquema de conversão %→R$ do
   * handleApplyDiscount acima, escopado à linha (quantity * unitPrice). Numa
   * venda de sócio vira decisão de clube (ux-revisao §2): % → acompanha a
   * quantidade; R$ → fixo; zero (qualquer modo) → "sem desconto" de propósito.
   */
  async function handleApplyItemDiscount(item: SaleItem) {
    if (!sale) return
    const raw = Number(itemDiscountValue.replace(',', '.'))
    if (Number.isNaN(raw) || raw < 0) {
      setItemDiscountError('Valor inválido.')
      return
    }
    setItemDiscountError(null)
    try {
      await enqueue(async () => {
        const current = latestSale()?.items.find((i) => i.productId === item.productId) ?? item
        const lineSubtotal = current.quantity * current.unitPrice
        const amount = itemDiscountMode === 'percent' ? percentToAmount(lineSubtotal, raw) : raw
        const updated = await applyItemDiscount.mutateAsync({ saleId: sale.id, itemId: current.id, discountAmount: amount })
        if (updated.discountSource === 'club') {
          setClubDecision(
            current.productId,
            amount === 0
              ? { kind: 'percent', percent: 0 }
              : itemDiscountMode === 'percent'
                ? { kind: 'percent', percent: raw }
                : { kind: 'fixed' },
          )
        }
      })
      setItemDiscountId(null)
      searchRef.current?.focus()
    } catch (e) {
      setItemDiscountError(describeError(e, 'Erro ao aplicar desconto.'))
    }
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
    setError(null)
    setNonMemberNotice(false)
    setClubHintDismissed(false)
    try {
      const newSale = await startSale.mutateAsync({ cashSessionId: cashSession.id })
      setSaleId(newSale.id)
      if (document) {
        // CPF/clube nunca bloqueiam a venda em si — ela já foi criada e pode
        // seguir. UX-10 (2026-10-22): a mensagem diz o que isso significa pro
        // operador (sem NFC-e, sem Clube) e como tentar de novo.
        let attached = false
        try {
          await attachCustomer.mutateAsync({ saleId: newSale.id, document })
          attached = true
        } catch (e) {
          setError(
            isDomainError(e)
              ? `${describeError(e, 'Não foi possível vincular o CPF a essa venda.')} A venda segue sem CPF.`
              : CPF_ATTACH_OFFLINE_MESSAGE,
          )
        }
        if (attached) {
          try {
            const withDiscount = await applyClubDiscount.mutateAsync({ saleId: newSale.id })
            setNonMemberNotice(withDiscount.discountSource !== 'club')
          } catch (e) {
            setError(isDomainError(e) ? describeError(e, CLUB_CHECK_OFFLINE_MESSAGE) : CLUB_CHECK_OFFLINE_MESSAGE)
          }
        }
      }
    } catch (e) {
      setGateError(describeError(e, 'Erro ao iniciar a venda.'))
    } finally {
      setGateSubmitting(false)
    }
  }

  /**
   * Muda a quantidade (PERF-03c / K2): PATCH mantém o mesmo item (id, preço,
   * desconto). Regra do Clube (ux-revisao §2): decisão em % > 0 reaplica o %
   * sobre a nova quantidade na mesma chamada; % 0, R$ fixo ou item ainda
   * pendente → só a quantidade (o backend limita o desconto ao subtotal).
   * Venda sem clube: desconto manual fica em R$ (decisão de 2026-09-01).
   * Quantidade 0 remove a linha e esquece a decisão. Só roda dentro da fila.
   */
  async function applyQuantity(current: Sale, item: SaleItem, newQty: number) {
    setPendingProductId(item.productId)
    try {
      if (newQty <= 0) {
        await removeItemMut.mutateAsync({ saleId: current.id, itemId: item.id })
        forgetClubDecision(item.productId)
        if (useCartStore.getState().selectedProductId === item.productId) setSelectedProductId(null)
        return
      }
      const decision = current.discountSource === 'club' ? useCartStore.getState().clubDecisions[item.productId] : undefined
      const discountAmount =
        decision?.kind === 'percent' && decision.percent > 0
          ? percentToAmount(newQty * item.unitPrice, decision.percent)
          : undefined
      await updateQty.mutateAsync({ saleId: current.id, itemId: item.id, quantity: newQty, discountAmount })
    } finally {
      setPendingProductId(null)
    }
  }

  function changeQty(productId: string, delta: number) {
    return runCartTask(async () => {
      const current = latestSale()
      const item = current?.items.find((i) => i.productId === productId)
      if (!current || !item) return
      await applyQuantity(current, item, item.quantity + delta)
    }, 'Erro ao atualizar quantidade.')
  }

  function removeLine(productId: string) {
    return runCartTask(async () => {
      const current = latestSale()
      const item = current?.items.find((i) => i.productId === productId)
      if (!current || !item) return
      await applyQuantity(current, item, 0)
    }, 'Erro ao remover item.')
  }

  /** Clube: grava o % (10-90 pelo dígito, ou o fallback de 30%) sobre o subtotal ATUAL da linha e registra a decisão. */
  function applyClubPercent(productId: string, percent: number, onlyIfUndecided = false) {
    return runCartTask(async () => {
      const current = latestSale()
      const item = current?.items.find((i) => i.productId === productId)
      if (!current || !item || current.discountSource !== 'club') return
      if (onlyIfUndecided && productId in useCartStore.getState().clubDecisions) return
      await applyItemDiscount.mutateAsync({
        saleId: current.id,
        itemId: item.id,
        discountAmount: percentToAmount(item.quantity * item.unitPrice, percent),
      })
      setClubDecision(productId, { kind: 'percent', percent })
    }, 'Erro ao aplicar o desconto do Clube.')
  }

  /**
   * Clube Saldão — fecha o desconto de um item "pendente" (sem decisão em
   * `clubDecisions`) em 30% de fallback. Chamado ao trocar de item
   * selecionado (bipar OUTRO produto) — o último item cai no F4.
   */
  function finalizeClubItemDiscount(productId: string) {
    // Rechecado dentro da fila: um dígito ainda enfileirado vence o fallback.
    void applyClubPercent(productId, CLUB_DEFAULT_DISCOUNT_PERCENT, true)
  }

  /** Corpo do bipe/seleção — só roda dentro da fila. */
  async function addProductNow(product: Product) {
    const current = latestSale()
    if (!current) {
      throw new Error('Inicie a venda informando o CPF (ou "sem CPF") antes de adicionar itens.')
    }
    const existing = current.items.find((i) => i.productId === product.id)
    if (existing) {
      await applyQuantity(current, existing, existing.quantity + 1)
    } else {
      await addItem.mutateAsync({ saleId: current.id, productId: product.id, quantity: 1, product })
    }
    // Clube Saldão — trocar de item selecionado fecha a decisão do anterior
    // (30% se o operador não digitou nada pra ele). Bipar o MESMO produto de
    // novo (aumenta quantidade) não conta como "próximo item".
    const previous = useCartStore.getState().selectedProductId
    if (current.discountSource === 'club' && previous && previous !== product.id) {
      finalizeClubItemDiscount(previous)
    }
    setSelectedProductId(product.id)
    // Clique no dropdown deixa o foco num botão que some — volta pra busca.
    const el = document.activeElement
    if (!el || el === document.body || el.tagName === 'BUTTON') searchRef.current?.focus()
  }

  function clearSearch() {
    setTerm('')
    setDebouncedTerm('')
    setHighlight(0)
  }

  function addProduct(product: Product) {
    setError(null)
    clearSearch()
    return runCartTask(() => addProductNow(product), 'Erro ao adicionar item.')
  }

  /** Leitura exata por código de barras (a busca não indexa código). UX-02: o código não fica no campo e aparece na mensagem. */
  function addByBarcode(code: string) {
    setError(null)
    return runCartTask(async () => {
      let product: Product
      try {
        product = (await findProductByBarcode(code)).product
      } catch (e) {
        if (isDomainError(e)) {
          throw new Error(`Produto não encontrado: ${code}. Confira o código ou busque pelo nome.`)
        }
        throw e
      }
      await addProductNow(product)
    }, 'Erro ao buscar o produto.')
  }

  /**
   * Enter na busca (ou no handler global, com a busca sem foco). O termo é
   * capturado e o campo limpo NA HORA, antes de processar: assim o próximo
   * bipe já começa num campo vazio mesmo com este ainda na fila.
   */
  function submitSearch() {
    const code = term.trim()
    if (!code) return
    // Clube Saldão — Enter com um único dígito pendente confirma o desconto
    // na hora, sem esperar a pausa (CLUB_DISCOUNT_DIGIT_DELAY_MS).
    if (sale?.discountSource === 'club' && selectedProductId && /^[1-9]$/.test(code)) {
      setTerm('')
      void applyClubPercent(selectedProductId, Number(code) * 10)
      return
    }
    // `matches` vem de `debouncedTerm` (250ms atrás de `term`) — só confia
    // nele quando o debounce já alcançou o texto atual. Bug real
    // (2026-08-19): um leitor USB digita + Enter bem mais rápido que 250ms,
    // então `matches` ainda refletia a ÚLTIMA busca por nome — todo código
    // lido virava o primeiro item daquela busca antiga.
    const searchIsFresh = debouncedTerm === code
    const chosen = searchIsFresh ? (matches[highlight] ?? (matches.length === 1 ? matches[0] : undefined)) : undefined
    if (chosen) {
      void addProduct(chosen)
      return
    }
    clearSearch()
    void addByBarcode(code)
  }

  /**
   * Clube Saldão — pausa depois de um único dígito (ver
   * CLUB_DISCOUNT_DIGIT_DELAY_MS acima). Só observa `term`, nunca intercepta
   * a tecla em si — o dígito digita normal na busca (feedback visual pro
   * operador) e, se ninguém mais chegar antes do tempo, vira o desconto do
   * item selecionado e o campo é limpo. Se mais caracteres chegarem (leitor
   * de código de barras), o cleanup cancela. Fora de venda de sócio nunca
   * dispara.
   */
  useEffect(() => {
    if (sale?.discountSource !== 'club' || !selectedProductId || !/^[1-9]$/.test(term)) return
    const percent = Number(term) * 10
    const productId = selectedProductId
    const timer = setTimeout(() => {
      setTerm('')
      void applyClubPercent(productId, percent)
    }, CLUB_DISCOUNT_DIGIT_DELAY_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, sale?.discountSource, selectedProductId])

  /**
   * Abre o pagamento (F4 ou botão "Finalizar") — numa venda de sócio,
   * primeiro aplica um dígito ainda pendente na busca e fecha em 30% os itens
   * sem decisão (ux-revisao §2, regra 5: só quem NÃO está em `clubDecisions`).
   * Espera tudo (via fila) antes de mostrar a tela de pagamento, pra não abrir
   * com um total que ainda vai mudar. UX-19: falha vira mensagem.
   */
  async function openPayment() {
    if (!sale) return
    setError(null)
    if (sale.discountSource === 'club' && selectedProductId && /^[1-9]$/.test(term.trim())) {
      const percent = Number(term.trim()) * 10
      setTerm('')
      void applyClubPercent(selectedProductId, percent)
    }
    try {
      await enqueue(async () => {
        const current = latestSale()
        if (!current || current.discountSource !== 'club') return
        const decisions = useCartStore.getState().clubDecisions
        for (const item of current.items.filter((i) => !(i.productId in decisions))) {
          await applyItemDiscount.mutateAsync({
            saleId: current.id,
            itemId: item.id,
            discountAmount: percentToAmount(item.quantity * item.unitPrice, CLUB_DEFAULT_DISCOUNT_PERCENT),
          })
          setClubDecision(item.productId, { kind: 'percent', percent: CLUB_DEFAULT_DISCOUNT_PERCENT })
        }
      })
      if ((latestSale()?.items.length ?? 0) > 0) setPaymentOpen(true)
    } catch (e) {
      setError(describeError(e, 'Não foi possível abrir o pagamento.'))
    }
  }

  /**
   * Esc / "Reiniciar venda" (UX-05, mantendo a decisão de 2026-08-26 "Esc
   * reinicia a venda"): venda vazia cancela na hora (caso do CPF errado);
   * com itens ou pagamento, o 1º Esc arma e mostra a faixa, o 2º (em até 3 s)
   * cancela. Passa pela fila pra não cancelar no meio de um bipe.
   */
  const cancelArmedRef = useRef(false)
  useEffect(() => {
    cancelArmedRef.current = cancelArmed
    if (!cancelArmed) return
    const t = setTimeout(() => setCancelArmed(false), CANCEL_CONFIRM_WINDOW_MS)
    return () => clearTimeout(t)
  }, [cancelArmed])

  function requestCancel() {
    const current = latestSale() ?? sale
    if (!current) return
    const hasContent =
      current.items.length > 0 || current.payments.some((p) => p.status === 'aprovado')
    if (hasContent && !cancelArmedRef.current) {
      setCancelArmed(true)
      return
    }
    setCancelArmed(false)
    cancelArmedRef.current = false
    void runCartTask(async () => {
      await cancelSale.mutateAsync(current.id)
      reset()
      clearSearch()
      setError(null)
      setNonMemberNotice(false)
    }, 'Erro ao cancelar a venda.')
  }

  /** ↑/↓ no carrinho (2026-09-01) — também com a busca sem foco (UX-06). */
  function moveSelection(delta: 1 | -1) {
    const list = latestSale()?.items ?? []
    if (list.length === 0) return
    const idx = list.findIndex((i) => i.productId === useCartStore.getState().selectedProductId)
    const next = idx < 0 ? (delta > 0 ? 0 : list.length - 1) : Math.min(Math.max(idx + delta, 0), list.length - 1)
    setSelectedProductId(list[next].productId)
  }

  /** +, −, Delete sobre o item selecionado (atalhos da barra). */
  function handleCartKey(key: string): boolean {
    const productId = useCartStore.getState().selectedProductId
    if (!productId) return false
    if (key === '+' || key === '=') void changeQty(productId, 1)
    else if (key === '-') void changeQty(productId, -1)
    else if (key === 'Delete') void removeLine(productId)
    else return false
    return true
  }

  /**
   * Navegação por teclado na busca. Com o dropdown aberto, ↑/↓ navegam os
   * resultados; sem ele, movem a seleção do carrinho. UX-06 (2026-10-22): com
   * o campo VAZIO, +/−/Delete agem no item selecionado (antes viravam texto
   * na busca) — nenhum leitor manda esses caracteres como primeiro char.
   */
  const handleSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (matches.length > 0 && term.trim()) setHighlight((h) => Math.min(h + 1, matches.length - 1))
      else moveSelection(1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (matches.length > 0 && term.trim()) setHighlight((h) => Math.max(h - 1, 0))
      else moveSelection(-1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (e.nativeEvent.isComposing || e.keyCode === 229) return
      submitSearch()
    } else if (e.key === 'Escape') {
      // Só consome o Escape se tiver texto pra limpar — campo já vazio deixa
      // borbulhar pro handler global (reinicia a venda).
      if (term) {
        e.stopPropagation()
        setTerm('')
      }
    } else if (term === '' && ['+', '=', '-', 'Delete'].includes(e.key)) {
      if (handleCartKey(e.key)) e.preventDefault()
    }
  }

  /**
   * Atalhos globais da tela de venda. O handler é recriado a cada render e
   * lido por ref, então sempre enxerga o estado atual (sem closure velho).
   */
  const onGlobalKeyRef = useRef<(e: KeyboardEvent) => void>(() => {})
  onGlobalKeyRef.current = (e: KeyboardEvent) => {
    const el = document.activeElement
    const typing = isTypingTarget(el)
    const dialogOpen = paymentOpen || !!receipt

    if (e.key === 'F2') {
      e.preventDefault()
      if (dialogOpen) return
      if (cashOpen && !sale) cpfInputRef.current?.focus()
      searchRef.current?.focus()
      searchRef.current?.select()
      return
    }
    if (e.key === 'F4') {
      e.preventDefault()
      if (!dialogOpen && sale && sale.items.length > 0) void openPayment()
      return
    }
    if (e.key === 'Escape') {
      // Antes do gate de `typing`: a busca fica com foco quase o tempo todo.
      // Campos que tratam Esc localmente (busca com texto, descontos, Modal)
      // chamam stopPropagation antes do evento chegar aqui.
      if (!dialogOpen) requestCancel()
      return
    }
    if (typing || dialogOpen || e.defaultPrevented) return

    // UX-01: sem venda, o portão de CPF está na tela — dígitos e Enter vão pra
    // ele. Sem preventDefault: mover o foco dentro do keydown faz o navegador
    // inserir o caractere no campo recém-focado (o mesmo efeito que
    // duplicava o 1º dígito na busca, aqui é exatamente o que se quer).
    if (cashOpen && !sale) {
      if (e.key === 'Enter' || (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey)) {
        if (e.key === 'Enter') e.preventDefault()
        cpfInputRef.current?.focus()
      }
      return
    }
    if (!sale) return

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      moveSelection(e.key === 'ArrowDown' ? 1 : -1)
    } else if (e.key === 'Enter') {
      // UX-03: Enter de um bipe que chegou com a busca sem foco.
      if (term.trim()) {
        e.preventDefault()
        submitSearch()
        searchRef.current?.focus()
      }
    } else if (handleCartKey(e.key)) {
      e.preventDefault()
    } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      // Leitor de código de barras USB (emulação de teclado): sem nenhum
      // input focado, o primeiro caractere foca a busca e é encaminhado pra
      // não se perder. preventDefault() é essencial aqui: mover o foco DENTRO
      // do keydown faz o navegador inserir o caractere no elemento
      // recém-focado — sem isso, o 1º caractere sairia duplicado ("77").
      e.preventDefault()
      const char = e.key
      setTerm((prev) => prev + char)
      searchRef.current?.focus()
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => onGlobalKeyRef.current(e)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // UX-01: recibo fechado ("Nova venda") → foco direto no CPF. O Modal do
  // recibo tinha roubado o foco e, ao sumir, deixava o foco no body.
  useEffect(() => {
    if (!receipt && cashOpen && !saleId) cpfInputRef.current?.focus()
  }, [receipt, cashOpen, saleId])

  function printWithFeedback(payload: ReceiptPrintPayload) {
    setPrintError(null)
    printReceipt.mutate(payload, {
      onError: (e) =>
        setPrintError(
          `${describeError(e, 'Não foi possível imprimir o cupom.')} Confira a impressora e use "Imprimir de novo".`,
        ),
    })
  }

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

      const received = useCartStore.getState().receivedByPaymentId
      const approvedPayments = confirmed.payments.filter((p) => p.status === 'aprovado')
      const changeTotal = approvedPayments.reduce((sum, p) => {
        const r = received[p.id] ?? p.amount
        return sum + Math.max(0, r - p.amount)
      }, 0)
      const customerDocument = saleCustomer?.document ? formatCpf(saleCustomer.document) : undefined

      const printBasePayload: PrintBasePayload = {
        saleId: confirmed.id,
        confirmedAt: confirmed.confirmedAt ?? new Date().toISOString(),
        items: confirmed.items.map((item) => ({
          name: productNames[item.productId] ?? item.productId,
          quantity: item.quantity,
          totalAmount: item.totalAmount,
        })),
        totalAmount: confirmed.totalAmount,
        payments: approvedPayments.map((p) => ({
          label: paymentDisplayLabel(p),
          amount: p.amount,
          received: received[p.id],
          change: received[p.id] ? Math.max(0, received[p.id] - p.amount) : undefined,
        })),
        customerDocument,
      }
      setPrintError(null)
      setReceipt({ sale: confirmed, changeTotal, printPayload: printBasePayload })

      // Impressão/gaveta nunca bloqueiam nem falham a venda — já foi
      // confirmada no backend antes daqui, hardware é sempre opcional.
      if (hardwareSettings?.autoPrintReceipt) {
        printWithFeedback(printBasePayload)
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
      clearSearch()
      setNonMemberNotice(false)
      setCancelArmed(false)
    } catch (e) {
      const usedStoreCredit = sale.payments.some((p) => p.status === 'aprovado' && p.method === 'vale_troca')
      const message = describeError(e, 'Erro ao confirmar pagamento.')
      // UX-10 (4): resgate do Vale-Troca depende da central.
      setPaymentError(
        usedStoreCredit && !isDomainError(e)
          ? `${message} Se a central estiver fora, remova o pagamento em Vale-Troca (lixeira) e use outra forma.`
          : message,
      )
    } finally {
      setPaymentSubmitting(false)
    }
  }

  const closeReceipt = useCallback(() => {
    setReceipt(null)
    setPrintError(null)
  }, [])

  const items = sale?.items ?? []
  const itemCount = items.reduce((s, i) => s + i.quantity, 0)
  const showClubHint = sale?.discountSource === 'club' && !clubHintDismissed

  return (
    <div className="flex h-full min-h-0">
      {/* Coluna esquerda: busca + carrinho */}
      <section className="flex min-w-0 flex-1 flex-col p-4">
        {!cashOpen && (
          <div className="mb-3 flex items-center justify-between gap-2 rounded-lg bg-muted px-4 py-2.5 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Lock className="size-4" />
              Abra o caixa antes de iniciar uma venda.
            </span>
            <button
              onClick={() => setView('caixa')}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Wallet className="size-4" />
              Abrir caixa
              <kbd className="rounded bg-primary-foreground/15 px-1 font-mono text-[10px]">F6</kbd>
            </button>
          </div>
        )}

        {error && (
          <div className="mb-3 rounded-lg bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive">
            {error}
          </div>
        )}

        {cancelArmed && sale && (
          <div className="mb-3 rounded-lg bg-destructive/10 px-4 py-2.5 text-base font-semibold text-destructive" role="alert">
            Pressione Esc de novo para cancelar a venda ({itemCount} {itemCount === 1 ? 'item' : 'itens'} ·{' '}
            {formatBRL(sale.totalAmount)})
          </div>
        )}

        {(showClubHint || nonMemberNotice) && (
          <div
            className={`mb-3 flex items-center justify-between gap-2 rounded-lg px-4 py-2.5 text-base ${
              showClubHint ? 'bg-primary/15 font-medium text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            <span>
              {showClubHint
                ? 'Cliente do Clube Saldão — ao bipar cada produto, digite 1-9 pra escolher o desconto (10%-90%). Sem nada digitado, cai em 30%.'
                : 'Cliente não pertence ao Clube Saldão.'}
            </span>
            <button
              onClick={() => {
                setClubHintDismissed(true)
                setNonMemberNotice(false)
              }}
              className="text-sm underline"
            >
              Ok
            </button>
          </div>
        )}

        {cashOpen && !sale ? (
          <CpfGateDialog
            submitting={gateSubmitting}
            error={gateError}
            onSubmit={startSaleWithDocument}
            inputRef={cpfInputRef}
          />
        ) : (
          <>
        {sale && (
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              {saleCustomer?.document ? `CPF: ${formatCpf(saleCustomer.document)}` : 'Venda sem CPF'}
              {creditBalance !== null && creditBalance > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 font-medium text-primary-foreground">
                  <Gift className="size-3.5" />
                  Vale-Troca: {formatBRL(creditBalance)}
                </span>
              )}
            </span>
            <button
              onClick={requestCancel}
              disabled={cancelSale.isPending}
              className={`text-sm underline decoration-dotted transition-colors hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50 ${
                cancelArmed ? 'font-semibold text-destructive' : 'text-muted-foreground'
              }`}
            >
              {cancelArmed ? 'Confirmar cancelamento (Esc)' : 'Reiniciar venda (Esc)'}
            </button>
          </div>
        )}

        {/* Busca — nunca `disabled` durante a adição (UX-03/F1): o foco fica
            no campo e o próximo bipe entra na fila de mutações do carrinho. */}
        <div className="relative">
          <div className="flex items-center gap-2 rounded-xl border-2 border-primary/40 bg-card px-3 shadow-sm focus-within:border-primary">
            <Search className={`size-5 text-muted-foreground ${adding ? 'animate-pulse' : ''}`} />
            <input
              ref={searchRef}
              autoFocus
              value={term}
              disabled={!cashOpen}
              aria-busy={adding}
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
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-base ${
                      i === highlight ? 'bg-primary/15' : 'hover:bg-muted'
                    }`}
                  >
                    <span className="font-mono text-sm text-muted-foreground">{p.sku}</span>
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
          <div className="grid grid-cols-[1fr_7rem_7rem_6rem_2.5rem_2.5rem] items-center gap-2 border-b border-border px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Produto</span>
            <span className="text-center">Qtd</span>
            <span className="text-right">Preço</span>
            <span className="text-right">Total</span>
            <span />
            <span />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                <ShoppingCart className="size-10 opacity-30" />
                <p className="text-base">Nenhum item. Leia um código ou busque (F2).</p>
              </div>
            ) : (
              items.map((item) => {
                const active = item.productId === selectedProductId
                const pending = pendingProductId === item.productId
                const hasItemDiscount = item.discountAmount > 0
                return (
                  <div key={item.id}>
                    <div
                      onClick={() => setSelectedProductId(item.productId)}
                      className={`grid cursor-pointer grid-cols-[1fr_7rem_7rem_6rem_2.5rem_2.5rem] items-center gap-2 border-l-2 px-4 py-2.5 text-base transition-opacity ${
                        active ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-muted/50'
                      } ${pending ? 'opacity-50' : ''}`}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{productNames[item.productId] ?? '…'}</p>
                        {hasItemDiscount && (
                          <p className="text-sm font-semibold text-primary-foreground">- {formatBRL(item.discountAmount)}</p>
                        )}
                      </div>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            void changeQty(item.productId, -1)
                          }}
                          disabled={pending}
                          className="grid size-8 place-items-center rounded-md bg-muted text-foreground transition-colors hover:bg-border disabled:cursor-not-allowed"
                          aria-label="Diminuir"
                        >
                          <Minus className="size-4" />
                        </button>
                        <span className="w-6 text-center font-mono font-semibold">{item.quantity}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            void changeQty(item.productId, 1)
                          }}
                          disabled={pending}
                          className="grid size-8 place-items-center rounded-md bg-muted text-foreground transition-colors hover:bg-border disabled:cursor-not-allowed"
                          aria-label="Aumentar"
                        >
                          <Plus className="size-4" />
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
                            if (itemDiscountId === item.id) {
                              setItemDiscountId(null)
                              return
                            }
                            setItemDiscountId(item.id)
                            setItemDiscountValue(hasItemDiscount ? String(item.discountAmount) : '')
                            setItemDiscountMode('amount')
                            setItemDiscountError(null)
                          }}
                          disabled={pending}
                          className={`grid size-7 place-items-center rounded-md transition-colors hover:bg-primary/15 hover:text-primary-foreground disabled:cursor-not-allowed ${
                            hasItemDiscount ? 'text-primary-foreground' : 'text-muted-foreground'
                          }`}
                          aria-label="Desconto no item"
                        >
                          <Percent className="size-4" />
                        </button>
                      </div>
                      <div className="flex justify-end">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            void removeLine(item.productId)
                          }}
                          disabled={pending}
                          className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed"
                          aria-label="Remover"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                    {itemDiscountId === item.id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="space-y-2 border-l-2 border-transparent bg-muted/30 px-4 py-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-muted-foreground">
                            Desconto em {productNames[item.productId] ?? 'item'}
                          </label>
                          <div className="flex overflow-hidden rounded-md border border-border text-xs font-semibold">
                            <button
                              onClick={() => setItemDiscountMode('amount')}
                              className={`px-2 py-0.5 ${itemDiscountMode === 'amount' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                            >
                              R$
                            </button>
                            <button
                              onClick={() => setItemDiscountMode('percent')}
                              className={`px-2 py-0.5 ${itemDiscountMode === 'percent' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                            >
                              %
                            </button>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <input
                            autoFocus
                            inputMode="decimal"
                            value={itemDiscountValue}
                            onChange={(e) => setItemDiscountValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                handleApplyItemDiscount(item)
                              } else if (e.key === 'Escape') {
                                e.stopPropagation()
                                setItemDiscountId(null)
                                setItemDiscountError(null)
                              }
                            }}
                            placeholder={itemDiscountMode === 'percent' ? '0' : '0,00'}
                            className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-primary"
                            aria-label="Valor do desconto do item"
                          />
                          <button
                            onClick={() => handleApplyItemDiscount(item)}
                            disabled={applyItemDiscount.isPending}
                            className="shrink-0 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Aplicar
                          </button>
                        </div>
                        {itemDiscountError && <p className="text-xs text-destructive">{itemDiscountError}</p>}
                      </div>
                    )}
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
                <span className="text-xs text-muted-foreground">por item — veja o carrinho</span>
              </div>
            ) : discountOpen ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground">Desconto</label>
                  <div className="flex overflow-hidden rounded-md border border-border text-xs font-semibold">
                    <button
                      onClick={() => setDiscountMode('amount')}
                      className={`px-2 py-0.5 ${discountMode === 'amount' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                    >
                      R$
                    </button>
                    <button
                      onClick={() => setDiscountMode('percent')}
                      className={`px-2 py-0.5 ${discountMode === 'percent' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                    >
                      %
                    </button>
                  </div>
                </div>
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
                    placeholder={discountMode === 'percent' ? '0' : '0,00'}
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
                  setDiscountMode('amount')
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
              {itemCount} itens
            </p>
          </div>
        </div>

        <button
          onClick={() => items.length > 0 && void openPayment()}
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
        customerDocument={saleCustomer?.document ?? null}
        submitting={paymentSubmitting}
        error={paymentError}
        onClose={() => {
          if (!paymentSubmitting) {
            setPaymentOpen(false)
            setPaymentError(null)
          }
        }}
        onPaymentRegistered={(payment, received) => setReceived(payment.id, received)}
        onConfirm={handleConfirmPayment}
      />
      <ReceiptDialog
        sale={receipt?.sale ?? null}
        productNames={productNames}
        changeTotal={receipt?.changeTotal ?? 0}
        onClose={closeReceipt}
        onReprint={isElectron() && receipt ? () => printWithFeedback(receipt.printPayload) : undefined}
        printing={printReceipt.isPending}
        printError={printError}
      />
    </div>
  )
}
