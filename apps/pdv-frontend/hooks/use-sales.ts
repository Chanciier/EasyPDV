import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PaymentMethod, Product, ResolvedPrice, Sale, SaleStatus } from '@easypdv/shared-types'
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
    mutationFn: (input: { saleId: string; method: PaymentMethod; amount: number }) =>
      apiRequest<Sale>(`/sales/${input.saleId}/payments`, {
        method: 'POST',
        body: { method: input.method, amount: input.amount },
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

export function useCancelSale() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (saleId: string) => apiRequest<Sale>(`/sales/${saleId}/cancel`, { method: 'POST' }),
    onSuccess: (sale) => queryClient.setQueryData(['sale', sale.id], sale),
  })
}
