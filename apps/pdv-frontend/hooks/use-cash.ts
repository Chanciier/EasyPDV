import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CashMovement, CashRegister, CashSession } from '@easypdv/shared-types'
import { apiRequest } from '@/lib/api-client'

export function useCashRegisters() {
  return useQuery({
    queryKey: ['cash-registers'],
    queryFn: () => apiRequest<CashRegister[]>('/cash/registers'),
  })
}

/**
 * Polling de 60 s só como rede de segurança (PERF-12): o realtime e as
 * próprias mutations já invalidam `['cash-session']` quando algo muda.
 */
export function useCurrentCashSession() {
  return useQuery({
    queryKey: ['cash-session', 'current'],
    queryFn: () => apiRequest<CashSession | null>('/cash/sessions/current'),
    refetchInterval: 60_000,
  })
}

export function useCashMovements(cashSessionId: string | undefined) {
  return useQuery({
    queryKey: ['cash-session', cashSessionId, 'movements'],
    queryFn: () => apiRequest<CashMovement[]>(`/cash/sessions/${cashSessionId}/movements`),
    enabled: !!cashSessionId,
  })
}

/**
 * Soma agregada no backend (PERF-08, contrato K4) — a mesma `sumCashPayments`
 * usada no fechamento. Antes baixava `GET /sales` (teto de 100 vendas com
 * itens e pagamentos) e somava aqui: errava a partir da 101ª venda da sessão.
 */
export function useCashSalesTotal(cashSessionId: string | undefined) {
  return useQuery({
    queryKey: ['cash-session', cashSessionId, 'cash-sales-total'],
    queryFn: async () => {
      const { total } = await apiRequest<{ total: number }>(`/cash/sessions/${cashSessionId}/cash-sales-total`)
      return total
    },
    enabled: !!cashSessionId,
  })
}

/**
 * Achado real (2026-09-16): "Abrir caixa" só via a sessão do PRÓPRIO
 * operador — quando o caixa já estava aberto por outro login (turno
 * anterior), não tinha como ver nem fechar pela tela. Só é chamada quando
 * `useOpenCashSession` falha (ver `enabled`), evita um GET solto toda hora.
 */
export function useOpenSessionForRegister(cashRegisterId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['cash-session', 'open-for-register', cashRegisterId ?? ''],
    queryFn: () => apiRequest<CashSession | null>(`/cash/registers/${cashRegisterId}/open-session`),
    enabled: enabled && !!cashRegisterId,
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
