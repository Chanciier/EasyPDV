import { useQuery } from '@tanstack/react-query'
import type { AuditLog } from '@easypdv/shared-types'
import { apiRequest } from '@/lib/api-client'

export function useAuditLogs(filters: { entityType?: string; userId?: string }) {
  return useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () =>
      apiRequest<AuditLog[]>('/audit-logs', {
        query: { entityType: filters.entityType, userId: filters.userId },
      }),
  })
}
