import { useQuery } from '@tanstack/react-query'
import type { CashSession, DashboardReport, SalesReportEntry, StockReportEntry } from '@easypdv/shared-types'
import { apiRequest } from '@/lib/api-client'

/**
 * Sem cap de 100 registros (diferente de GET /sales) — agregado no banco.
 * É o resumo "ao vivo" do dia mostrado no Histórico; o realtime (Sprint 13)
 * invalida essa query nos eventos de venda/caixa pra atualizar sem polling.
 *
 * GET /reports/sales, /reports/cash-sessions e /reports/stock também existem
 * no backend (Sprint 13) mas ainda sem tela dedicada no frontend — corte de
 * escopo deliberado, ver docs/CHANGELOG.md.
 */
export function useDashboardReport() {
  return useQuery({
    queryKey: ['reports', 'dashboard'],
    queryFn: () => apiRequest<DashboardReport>('/reports/dashboard'),
  })
}

/** Restrito a administrador/gerente/proprietario no backend — ver ReportsController. */
export function useSalesReport(params: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ['reports', 'sales', params],
    queryFn: () =>
      apiRequest<SalesReportEntry[]>('/reports/sales', { query: { from: params.from, to: params.to } }),
  })
}

export function useCashSessionsReport(params: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ['reports', 'cash-sessions', params],
    queryFn: () =>
      apiRequest<CashSession[]>('/reports/cash-sessions', { query: { from: params.from, to: params.to } }),
  })
}

/** V1 tem 1 depósito por loja — sem seletor de depósito na tela, warehouseId fica sempre indefinido (retorna tudo). */
export function useStockReport() {
  return useQuery({
    queryKey: ['reports', 'stock'],
    queryFn: () => apiRequest<StockReportEntry[]>('/reports/stock'),
  })
}
