import { useMutation } from '@tanstack/react-query'
import type { ActivationCodeResult } from '@easypdv/shared-types'
import { apiRequest } from '@/lib/api-client'

export function useGenerateActivationCode() {
  return useMutation({
    mutationFn: () => apiRequest<ActivationCodeResult>('/provisioning/activation-codes', { method: 'POST' }),
  })
}
