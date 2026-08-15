import { useQuery } from '@tanstack/react-query'
import type { DashboardReport } from '@easypdv/shared-types'
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
