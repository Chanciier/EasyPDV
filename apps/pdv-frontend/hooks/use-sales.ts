import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  FiscalDocument,
  PaymentCardBrand,
  PaymentCardType,
  PaymentMethod,
  Product,
  ResolvedPrice,
  Sale,
  SaleStatus,
  VoidSaleResult,
} from '@easypdv/shared-types'
import { apiRequest } from '@/lib/api-client'

export type { VoidSaleResult }

/**
 * `finalizedOnly` (contrato K3): só vendas que chegaram a ser confirmadas
 * (confirmadas e estornadas). Sem ele, cada "Reiniciar venda" virava uma
 * linha "Cancelada" no Histórico e ocupava o limite de 100 registros.
 */
export function useSalesList(params?: {
  status?: SaleStatus | SaleStatus[]
  cashSessionId?: string
  finalizedOnly?: boolean
}) {
  return useQuery({
    queryKey: ['sales', 'list', params ?? {}],
    queryFn: () =>
      apiRequest<Sale[]>('/sales', {
        query: {
          status: params?.status,
          cashSessionId: params?.cashSessionId,
          finalizedOnly: params?.finalizedOnly ? 'true' : undefined,
        },
      }),
  })
}

export function useProductSearch(query: string) {
  const trimmed = query.trim()
  return useQuery({
    queryKey: ['products', 'search', trimmed],
    queryFn: () => apiRequest<Product[]>('/products/search', { query: { query: trimmed } }),
    enabled: trimmed.length > 0,
  })
}

/** Limite do contrato K1 (`GET /products/prices?ids=` aceita 1–200 ids). */
const PRICE_BATCH_MAX = 200

type PriceWaiter = { resolve: (price: ResolvedPrice | null) => void; reject: (error: unknown) => void }
const pendingPriceRequests = new Map<string, PriceWaiter[]>()
let priceFlushTimer: ReturnType<typeof setTimeout> | null = null

async function flushPriceRequests() {
  priceFlushTimer = null
  const batch = new Map(pendingPriceRequests)
  pendingPriceRequests.clear()
  const ids = Array.from(batch.keys())
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += PRICE_BATCH_MAX) chunks.push(ids.slice(i, i + PRICE_BATCH_MAX))
  await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const prices = await apiRequest<ResolvedPrice[]>('/products/prices', { query: { ids: chunk.join(',') } })
        const byId = new Map(prices.map((p) => [p.productId, p]))
        for (const id of chunk) batch.get(id)?.forEach((w) => w.resolve(byId.get(id) ?? null))
      } catch (error) {
        for (const id of chunk) batch.get(id)?.forEach((w) => w.reject(error))
      }
    }),
  )
}

/** Junta todos os pedidos de preço do mesmo tick numa requisição só (K1). */
function loadPriceBatched(productId: string): Promise<ResolvedPrice | null> {
  return new Promise((resolve, reject) => {
    const waiters = pendingPriceRequests.get(productId) ?? []
    waiters.push({ resolve, reject })
    pendingPriceRequests.set(productId, waiters)
    if (!priceFlushTimer) priceFlushTimer = setTimeout(() => void flushPriceRequests(), 0)
  })
}

/** Estável no módulo: o `combine` só reexecuta quando os resultados mudam. */
function combinePriceResults(results: { data: ResolvedPrice | null | undefined; isLoading: boolean }[]) {
  return results.map((r) => ({ data: r.data ?? undefined, isLoading: r.isLoading }))
}

/**
 * Preços resolvidos de vários produtos (PERF-02 / contrato K1). Antes era um
 * `GET /products/:id/price` por linha (100 na tela Produtos). Agora o cache
 * continua por produto (`['product-price', id]`, então invalidar um id ou o
 * prefixo segue funcionando), mas tudo o que falta no cache no mesmo render
 * sai numa única chamada em lote; o que já está no cache nem vai à rede.
 * Formato de retorno mantido: array alinhado a `productIds`, cada posição com
 * `.data` (undefined = sem preço / carregando) e `.isLoading`.
 */
export function useProductPrices(productIds: string[]) {
  return useQueries({
    queries: productIds.map((id) => ({
      queryKey: ['product-price', id],
      queryFn: () => loadPriceBatched(id),
      staleTime: 60_000,
    })),
    combine: combinePriceResults,
  })
}

export function useProducts(productIds: string[]) {
  return useQueries({
    queries: productIds.map((id) => ({
      queryKey: ['product', id],
      queryFn: () => apiRequest<Product>(`/products/${id}`),
      staleTime: 60_000,
    })),
  })
}

export async function findProductByBarcode(code: string) {
  return apiRequest<{ product: Product; price: ResolvedPrice }>(
    `/products/by-barcode/${encodeURIComponent(code)}`,
  )
}

export function useSale(saleId: string | null) {
  return useQuery({
    queryKey: ['sale', saleId],
    queryFn: () => apiRequest<Sale>(`/sales/${saleId}`),
    enabled: !!saleId,
  })
}

/**
 * As mutações abaixo recebem saleId como parte do input (em vez de fechado
 * no hook) de propósito: no primeiro item de uma venda, o saleId nasce
 * "lazy" (POST /sales) dentro do mesmo handler que já chama addItem em
 * seguida — presa ao valor do hook no momento do render, essa segunda
 * chamada ainda veria o saleId antigo (null) por causa do closure. Recebendo
 * o id no próprio mutate(), e atualizando o cache pela resposta (que sempre
 * traz sale.id), não existe esse risco de stale closure.
 */
export function useStartSale() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { cashSessionId: string; customerId?: string }) =>
      apiRequest<Sale>('/sales', { method: 'POST', body: input }),
    onSuccess: (sale) => queryClient.setQueryData(['sale', sale.id], sale),
  })
}

/**
 * `product` opcional (PERF-03a): quem já tem o produto na mão (bipe ou busca)
 * semeia `['product', id]` — o nome aparece na linha na hora, sem o "…" e sem
 * um `GET /products/:id` a mais por item novo.
 */
export function useAddSaleItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { saleId: string; productId: string; quantity: number; product?: Product }) =>
      apiRequest<Sale>(`/sales/${input.saleId}/items`, {
        method: 'POST',
        body: { productId: input.productId, quantity: input.quantity },
      }),
    onMutate: (input) => {
      if (input.product) queryClient.setQueryData(['product', input.product.id], input.product)
    },
    onSuccess: (sale) => queryClient.setQueryData(['sale', sale.id], sale),
  })
}

/**
 * Muda a quantidade de um item mantendo o mesmo id e preço (PERF-03c /
 * contrato K2) — antes era DELETE + POST, o item ganhava id novo e perdia o
 * desconto. Sem `discountAmount` o backend mantém o desconto em R$ (limitado
 * ao novo subtotal); com ele, grava quantidade + desconto numa transação só
 * (usado pra reaplicar o % do Clube sobre a nova quantidade).
 */
export function useUpdateSaleItemQuantity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { saleId: string; itemId: string; quantity: number; discountAmount?: number }) =>
      apiRequest<Sale>(`/sales/${input.saleId}/items/${input.itemId}`, {
        method: 'PATCH',
        body:
          input.discountAmount === undefined
            ? { quantity: input.quantity }
            : { quantity: input.quantity, discountAmount: input.discountAmount },
      }),
    onSuccess: (sale) => queryClient.setQueryData(['sale', sale.id], sale),
  })
}

export function useRemoveSaleItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { saleId: string; itemId: string }) =>
      apiRequest<Sale>(`/sales/${input.saleId}/items/${input.itemId}`, { method: 'DELETE' }),
    onSuccess: (sale) => queryClient.setQueryData(['sale', sale.id], sale),
  })
}

export function useRegisterPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      saleId: string
      method: PaymentMethod
      amount: number
      cardType?: PaymentCardType | null
      cardBrand?: PaymentCardBrand | null
      installments?: number | null
    }) =>
      apiRequest<Sale>(`/sales/${input.saleId}/payments`, {
        method: 'POST',
        body: {
          method: input.method,
          amount: input.amount,
          cardType: input.cardType ?? undefined,
          cardBrand: input.cardBrand ?? undefined,
          installments: input.installments ?? undefined,
        },
      }),
    onSuccess: (sale) => queryClient.setQueryData(['sale', sale.id], sale),
  })
}

/** Pagamento dividido (2026-08-21) — corrige uma perna registrada errado sem reiniciar a venda. */
export function useRemovePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { saleId: string; paymentId: string }) =>
      apiRequest<Sale>(`/sales/${input.saleId}/payments/${input.paymentId}`, { method: 'DELETE' }),
    onSuccess: (sale) => queryClient.setQueryData(['sale', sale.id], sale),
  })
}

export function useApplySaleDiscount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { saleId: string; discountAmount: number }) =>
      apiRequest<Sale>(`/sales/${input.saleId}/discount`, {
        method: 'PATCH',
        body: { discountAmount: input.discountAmount },
      }),
    onSuccess: (sale) => queryClient.setQueryData(['sale', sale.id], sale),
  })
}

/** Desconto individual por item do carrinho (2026-09-01) — independente do desconto da venda inteira, os dois coexistem. `discountAmount: 0` remove. */
export function useApplyItemDiscount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { saleId: string; itemId: string; discountAmount: number }) =>
      apiRequest<Sale>(`/sales/${input.saleId}/items/${input.itemId}/discount`, {
        method: 'PATCH',
        body: { discountAmount: input.discountAmount },
      }),
    onSuccess: (sale) => queryClient.setQueryData(['sale', sale.id], sale),
  })
}

/**
 * Clube Saldão (2026-08-25) — aplica os 30% se o cliente já anexado à venda
 * for membro; se não for, devolve a venda sem nenhuma mudança (checagem
 * silenciosa, nunca lança erro por "não é membro" — ver
 * ApplyClubDiscountUseCase no backend). O chamador compara
 * `discountSource` antes/depois pra saber se aplicou ou não.
 */
export function useApplyClubDiscount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { saleId: string }) =>
      apiRequest<Sale>(`/sales/${input.saleId}/club-discount`, { method: 'PATCH' }),
    onSuccess: (sale) => queryClient.setQueryData(['sale', sale.id], sale),
  })
}

/** "CPF na nota" — anexa/troca o cliente de uma venda em andamento. Chamado logo no início da venda (2026-08-25) — ver CpfGateDialog em sale-view.tsx. */
export function useAttachCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { saleId: string; document: string; name?: string }) =>
      apiRequest<Sale>(`/sales/${input.saleId}/customer`, {
        method: 'PATCH',
        body: { document: input.document, name: input.name },
      }),
    onSuccess: (sale) => queryClient.setQueryData(['sale', sale.id], sale),
  })
}

export function useConfirmSale() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (saleId: string) => apiRequest<Sale>(`/sales/${saleId}/confirm`, { method: 'POST' }),
    onSuccess: (sale) => {
      queryClient.setQueryData(['sale', sale.id], sale)
      // venda confirmada em dinheiro muda o saldo esperado do caixa (ver useCashSalesTotal)
      queryClient.invalidateQueries({ queryKey: ['cash-session'] })
    },
  })
}

/** Intervalo do modo "until-final": começa em 3 s e cresce até 10 s. */
function untilFinalInterval(updateCount: number): number {
  return Math.min(10_000, 3_000 + updateCount * 1_000)
}

/**
 * Status fiscal de uma venda. O pdv-backend tenta a central a cada chamada e
 * cai pro cache local se a rede falhar. `null` é normal: nem toda venda tem
 * NFC-e (emissão é opt-in).
 *
 * Dois modos de polling (PERF-07):
 * - `'pending-only'` (Histórico): só repete enquanto o documento está
 *   `pending`. Para em `null` e em qualquer estado final — antes ficava a 3 s
 *   pra sempre com o detalhe de uma venda sem nota aberto.
 * - `'until-final'` (impressão automática, FiscalPrintWatcher): logo depois
 *   de confirmar a venda o documento ainda não existe (`null`), então continua
 *   consultando até `issued`/`error`/`cancelled`, com intervalo crescendo de
 *   3 s pra 10 s. O teto de ~3 min fica no próprio watcher.
 */
export function useFiscalStatus(saleId: string | null, options?: { poll?: 'pending-only' | 'until-final' }) {
  const poll = options?.poll
  return useQuery({
    queryKey: ['fiscal-status', saleId],
    queryFn: () => apiRequest<FiscalDocument | null>(`/sales/${saleId}/fiscal`),
    enabled: !!saleId,
    refetchInterval: poll
      ? (query) => {
          const status = query.state.data?.status
          if (poll === 'pending-only') return status === 'pending' ? 3_000 : false
          if (status === 'issued' || status === 'error' || status === 'cancelled') return false
          return untilFinalInterval(query.state.dataUpdateCount)
        }
      : undefined,
  })
}

/**
 * Emissão manual de NFC-e pra venda sem CPF (Histórico, 2026-08-26) — ação
 * explícita do operador, só faz sentido pra vendas cujo FiscalDocument é
 * "comprovante_nao_fiscal" (a NFC-e sai pra "Consumidor Final", sem CPF —
 * válida normalmente, CPF na nota é sempre opcional). Pode voltar "pending"
 * (SEFAZ é assíncrono) — quem chama continua usando useFiscalStatus com
 * `poll: 'pending-only'` pra acompanhar até "issued"/"error".
 */
export function useIssueFiscalReceipt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (saleId: string) =>
      apiRequest<FiscalDocument | null>(`/sales/${saleId}/fiscal/issue`, { method: 'POST' }),
    onSuccess: (doc, saleId) => {
      queryClient.setQueryData(['fiscal-status', saleId], doc)
    },
  })
}

/**
 * Reenvio manual de NFC-e "error" (Histórico, 2026-09-02) — depois de uma
 * rejeição da SEFAZ (ex: código 704 "Data-Hora de emissão atrasada", em
 * geral transitória). O retry automático (FiscalRetryWorker, Intermediador)
 * já tenta sozinho algumas vezes; este botão é pra quando o operador não
 * quer esperar ou quer confirmar que já foi resolvido.
 */
export function useRetryFiscalReceipt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (saleId: string) =>
      apiRequest<FiscalDocument | null>(`/sales/${saleId}/fiscal/retry`, { method: 'POST' }),
    onSuccess: (doc, saleId) => {
      queryClient.setQueryData(['fiscal-status', saleId], doc)
    },
  })
}

/**
 * Reemissão manual de NFC-e "error" (Histórico, 2026-09-16) — pra quando
 * "Tentar novamente" (useRetryFiscalReceipt) não resolve: aquele reenvia o
 * MESMO rascunho já gerado no Bling, sem tocar em `dhEmi`, então uma rejeição
 * por código 704 "Data-Hora de emissão atrasada" nunca se recupera sozinha —
 * cada reenvio só aumenta o atraso (confirmado contra dado real de produção,
 * venda cmu3dbdpi1tf3mp4saoqtnium). Este botão descarta o rascunho rejeitado
 * e gera um novo, com `dhEmi` fresco — fiscalmente correto, uma NFC-e nunca
 * autorizada pela SEFAZ não "existiu" pra fins fiscais, o número só fica
 * pulado.
 */
export function useReissueFiscalReceipt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (saleId: string) =>
      apiRequest<FiscalDocument | null>(`/sales/${saleId}/fiscal/reissue`, { method: 'POST' }),
    onSuccess: (doc, saleId) => {
      queryClient.setQueryData(['fiscal-status', saleId], doc)
    },
  })
}

export function useCancelSale() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (saleId: string) => apiRequest<Sale>(`/sales/${saleId}/cancel`, { method: 'POST' }),
    onSuccess: (sale) => queryClient.setQueryData(['sale', sale.id], sale),
  })
}

/**
 * Estorno de venda confirmada (Sprint 14) — devolve estoque. Se a venda usou
 * Vale-Troca, o backend tenta devolver o saldo na central depois do estorno
 * local (K6): `storeCreditRefund.status = 'pending'` = estorno feito, saldo
 * não devolvido (ajuste manual em Clientes). Restrito à gerência no backend.
 */
export function useVoidSale() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { saleId: string; reason: string }) =>
      apiRequest<VoidSaleResult>(`/sales/${input.saleId}/void`, {
        method: 'POST',
        body: { reason: input.reason },
      }),
    onSuccess: (sale) => {
      queryClient.setQueryData(['sale', sale.id], sale)
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      queryClient.invalidateQueries({ queryKey: ['cash-session'] })
    },
  })
}
