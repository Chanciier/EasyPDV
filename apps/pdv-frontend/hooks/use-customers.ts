import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Customer } from '@easypdv/shared-types'
import { apiRequest } from '@/lib/api-client'

/** Sem `query`, devolve todos (tela de gestão de Clientes); com `query`, filtra (autocomplete da Venda). */
export function useCustomerSearch(query?: string) {
  const trimmed = query?.trim()
  return useQuery({
    queryKey: ['customers', 'search', trimmed ?? ''],
    queryFn: () => apiRequest<Customer[]>('/customers', { query: { query: trimmed } }),
  })
}

/** Busca um cliente por id — usado pra reimprimir o cupom fiscal com o CPF (Histórico só tem `sale.customerId`, não o cliente inteiro). */
export function useCustomer(id: string | null) {
  return useQuery({
    queryKey: ['customers', id],
    queryFn: () => apiRequest<Customer>(`/customers/${id}`),
    enabled: !!id,
  })
}

export function useCreateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; document?: string; phone?: string; email?: string }) =>
      apiRequest<Customer>('/customers', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
  })
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      id: string
      data: { name?: string; document?: string | null; phone?: string | null; email?: string | null }
    }) => apiRequest<Customer>(`/customers/${input.id}`, { method: 'PATCH', body: input.data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
  })
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiRequest<{ success: boolean }>(`/customers/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
  })
}
