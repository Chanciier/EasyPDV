import { useQuery } from '@tanstack/react-query'
import type { SyncStatusSummary } from '@easypdv/shared-types'
import { apiRequest } from '@/lib/api-client'

/**
 * "Modo contingência" básico (Sprint 15) — indicador pra qualquer operador
 * de que a sincronização com o Intermediador está pendente/falhando. Sem
 * @Roles no backend (diferente de GET /sync/outbox, restrito a gestão) —
 * é só contagem, não o detalhe. Polling (não é empurrado por realtime) a
 * cada 30 s (PERF-12, era 15 s): o indicador pode demorar até 30 s para
 * acender, aceitável — o próprio worker só tenta a cada 15 s.
 */
export function useSyncStatus() {
  return useQuery({
    queryKey: ['sync', 'status'],
    queryFn: () => apiRequest<SyncStatusSummary>('/sync/status'),
    refetchInterval: 30_000,
  })
}
