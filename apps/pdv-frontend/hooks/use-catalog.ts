import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Category, PriceList, Product, ResolvedPrice } from '@easypdv/shared-types'
import { apiRequest } from '@/lib/api-client'

/**
 * Tela de gestão de Produtos: ao contrário de useProductSearch (hooks/use-sales.ts,
 * usado no autocomplete da Venda), aqui a busca dispara mesmo com termo vazio —
 * é a listagem principal da tela, não um dropdown. /products/search com query=""
 * já devolve os produtos ativos (até 25, sem paginação — limite conhecido do V1).
 */
export function useProductList(query: string) {
  const trimmed = query.trim()
  return useQuery({
    queryKey: ['products', 'search', trimmed],
    queryFn: () => apiRequest<Product[]>('/products/search', { query: { query: trimmed } }),
  })
}

/** Estoque de todo o catálogo (depósito padrão) num tiro só — coluna "Estoque" da tela Produtos (2026-08-19). */
export function useStockList() {
  return useQuery({
    queryKey: ['stock', 'list'],
    queryFn: () => apiRequest<{ productId: string; quantity: number }[]>('/stock'),
  })
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => apiRequest<Category[]>('/categories'),
  })
}

export function useActivePriceList() {
  return useQuery({
    queryKey: ['price-lists', 'active'],
    queryFn: () => apiRequest<PriceList | null>('/price-lists/active'),
  })
}

/** 404 (PriceNotSetError) é esperado para produto sem preço cadastrado — não é retentado. */
export function useProductPrice(productId: string | null) {
  return useQuery({
    queryKey: ['product-price', productId],
    queryFn: () => apiRequest<ResolvedPrice>(`/products/${productId}/price`),
    enabled: !!productId,
    retry: false,
  })
}

export function useCreateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { sku: string; name: string; categoryId?: string; unit: string }) =>
      apiRequest<Product>('/products', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products', 'search'] }),
  })
}

export function useUpdateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      id: string
      data: { name?: string; categoryId?: string | null; unit?: string; active?: boolean }
    }) => apiRequest<Product>(`/products/${input.id}`, { method: 'PATCH', body: input.data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products', 'search'] }),
  })
}

export function useAddBarcode() {
  return useMutation({
    mutationFn: (input: { productId: string; code: string; type?: 'ean13' | 'interno' | 'fornecedor' }) =>
      apiRequest<{ success: boolean }>(`/products/${input.productId}/barcodes`, {
        method: 'POST',
        body: { code: input.code, type: input.type ?? 'ean13' },
      }),
  })
}

export function useCreateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; parentCategoryId?: string }) =>
      apiRequest<Category>('/categories', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export function useSyncProductsFromBling() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiRequest<{ created: number; updated: number; deactivated: number; total: number }>('/products/sync-bling', { method: 'POST' }),
    // Achado real (2026-08-21): sincronizar atualizava preço/estoque certo
    // no banco, mas só invalidava a busca de produtos — a coluna Estoque
    // (useStockList) e o preço por produto (useProductPrice/useProductPrices,
    // mesma chave 'product-price') continuavam mostrando o valor de ANTES da
    // sincronização até o usuário trocar de tela e voltar.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', 'search'] })
      queryClient.invalidateQueries({ queryKey: ['stock', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['product-price'] })
    },
  })
}

export function useSetPrice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { priceListId: string; productId: string; price: number; promotionalPrice?: number }) =>
      apiRequest<unknown>(`/price-lists/${input.priceListId}/items`, {
        method: 'POST',
        body: { productId: input.productId, price: input.price, promotionalPrice: input.promotionalPrice },
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['product-price', variables.productId] })
    },
  })
}
