import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CashMovement, CashRegister, CashSession, Sale } from '@easypdv/shared-types'
import { apiRequest } from '@/lib/api-client'

export function useCashRegisters() {
  return useQuery({
    queryKey: ['cash-registers'],
    queryFn: () => apiRequest<CashRegister[]>('/cash/registers'),
  })
}

export function useCurrentCashSession() {
  return useQuery({
    queryKey: ['cash-session', 'current'],
    queryFn: () => apiRequest<CashSession | null>('/cash/sessions/current'),
    refetchInterval: 15_000,
  })
}

export function useCashMovements(cashSessionId: string | undefined) {
  return useQuery({
    queryKey: ['cash-session', cashSessionId, 'movements'],
    queryFn: () => apiRequest<CashMovement[]>(`/cash/sessions/${cashSessionId}/movements`),
    enabled: !!cashSessionId,
  })
}

/** Não tem endpoint agregado dedicado — deriva do valor já embutido em cada venda confirmada da sessão. */
export function useCashSalesTotal(cashSessionId: string | undefined) {
  return useQuery({
    queryKey: ['cash-session', cashSessionId, 'cash-sales-total'],
    queryFn: async () => {
      const sales = await apiRequest<Sale[]>('/sales', {
        query: { cashSessionId, status: 'confirmed' },
      })
      return sales.reduce((sum, sale) => {
        const cashPaid = sale.payments
          .filter((p) => p.method === 'dinheiro' && p.status === 'aprovado')
          .reduce((s, p) => s + p.amount, 0)
        return sum + cashPaid
      }, 0)
    },
    enabled: !!cashSessionId,
  })
}

export function useOpenCashSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { cashRegisterId: string; openingAmount: number }) =>
      apiRequest<CashSession>('/cash/sessions', { method: 'POST', body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-session'] })
    },
  })
}

export function useCloseCashSession(cashSessionId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (closingAmount: number) =>
      apiRequest<CashSession>(`/cash/sessions/${cashSessionId}/close`, {
        method: 'PATCH',
        body: { closingAmount },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-session'] })
    },
  })
}

export function useRegisterCashMovement(cashSessionId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { type: 'sangria' | 'suprimento' | 'ajuste'; amount: number; reason?: string }) =>
      apiRequest<CashMovement>(`/cash/sessions/${cashSessionId}/movements`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-session', cashSessionId, 'movements'] })
      queryClient.invalidateQueries({ queryKey: ['cash-session', 'current'] })
    },
  })
}
