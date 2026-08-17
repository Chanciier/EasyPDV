import { useQuery } from '@tanstack/react-query'
import type { SyncStatusSummary } from '@easypdv/shared-types'
import { apiRequest } from '@/lib/api-client'

/**
 * "Modo contingência" básico (Sprint 15) — indicador pra qualquer operador
 * de que a sincronização com o Intermediador está pendente/falhando. Sem
 * @Roles no backend (diferente de GET /sync/outbox, restrito a gestão) —
 * é só contagem, não o detalhe. Polling (não é empurrado por realtime),
 * mesma cadência do SyncOutboxWorker (15s).
 */
export function useSyncStatus() {
  return useQuery({
    queryKey: ['sync', 'status'],
    queryFn: () => apiRequest<SyncStatusSummary>('/sync/status'),
    refetchInterval: 15_000,
  })
}
