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
} from '@easypdv/shared-types'
import { apiRequest } from '@/lib/api-client'

export function useSalesList(params?: { status?: SaleStatus | SaleStatus[]; cashSessionId?: string }) {
  return useQuery({
    queryKey: ['sales', 'list', params ?? {}],
    queryFn: () =>
      apiRequest<Sale[]>('/sales', {
        query: { status: params?.status, cashSessionId: params?.cashSessionId },
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

/** N pequeno (resultados da busca, itens do carrinho) — sem endpoint em lote no backend ainda. */
export function useProductPrices(productIds: string[]) {
  return useQueries({
    queries: productIds.map((id) => ({
      queryKey: ['product-price', id],
      queryFn: () => apiRequest<ResolvedPrice>(`/products/${id}/price`),
      staleTime: 60_000,
    })),
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

export function useAddSaleItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { saleId: string; productId: string; quantity: number }) =>
      apiRequest<Sale>(`/sales/${input.saleId}/items`, {
        method: 'POST',
        body: { productId: input.productId, quantity: input.quantity },
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

/**
 * Consulta sob demanda (não polling) — o pdv-backend já tenta buscar o status
 * mais recente no Intermediador a cada chamada, caindo pro cache local se a
 * rede falhar. `null` é normal: nem toda venda tem NFC-e (emissão é opt-in
 * no Intermediador, ver Sprint 12).
 */
export function useFiscalStatus(saleId: string | null, options?: { pollWhilePending?: boolean }) {
  return useQuery({
    queryKey: ['fiscal-status', saleId],
    queryFn: () => apiRequest<FiscalDocument | null>(`/sales/${saleId}/fiscal`),
    enabled: !!saleId,
    // "Imprimir nota no momento da venda" (2026-08-21): a emissão da NFC-e é
    // assíncrona (passa pelo Bling em segundo plano) — sem polling, o
    // status só atualiza se o usuário reabrir a tela manualmente. Só reconsulta
    // enquanto ainda não tem um resultado final (sem documento, ou "pending"),
    // pra não continuar batendo pra sempre numa venda já resolvida.
    refetchInterval: options?.pollWhilePending
      ? (query) => {
          const status = query.state.data?.status
          return status === 'issued' || status === 'error' ? false : 3000
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
 * pollWhilePending pra acompanhar até "issued"/"error".
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

export function useCancelSale() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (saleId: string) => apiRequest<Sale>(`/sales/${saleId}/cancel`, { method: 'POST' }),
    onSuccess: (sale) => queryClient.setQueryData(['sale', sale.id], sale),
  })
}

/** Estorno de venda confirmada (Sprint 14) — devolve estoque, sem reembolso automático. Restrito a administrador/gerente no backend. */
export function useVoidSale() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { saleId: string; reason: string }) =>
      apiRequest<Sale>(`/sales/${input.saleId}/void`, {
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
