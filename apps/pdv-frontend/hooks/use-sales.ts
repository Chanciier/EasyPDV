import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  FiscalDocument,
  PaymentCardType,
  PaymentMethod,
  Product,
  ResolvedPrice,
  Sale,
  SaleStatus,
} from '@easypdv/shared-types'
import { apiRequest } from '@/lib/api-client'

export function useSalesList(params?: { status?: SaleStatus; cashSessionId?: string }) {
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
      installments?: number | null
    }) =>
      apiRequest<Sale>(`/sales/${input.saleId}/payments`, {
        method: 'POST',
        body: {
          method: input.method,
          amount: input.amount,
          cardType: input.cardType ?? undefined,
          installments: input.installments ?? undefined,
        },
      }),
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
export function useFiscalStatus(saleId: string | null) {
  return useQuery({
    queryKey: ['fiscal-status', saleId],
    queryFn: () => apiRequest<FiscalDocument | null>(`/sales/${saleId}/fiscal`),
    enabled: !!saleId,
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
