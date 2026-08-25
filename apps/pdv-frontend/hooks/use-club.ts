import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ClubMember } from '@easypdv/shared-types'
import { apiRequest } from '@/lib/api-client'

export function useClubMembers() {
  return useQuery({
    queryKey: ['club', 'members'],
    queryFn: () => apiRequest<ClubMember[]>('/club/members'),
  })
}

/** Usado no início da venda pra checar se o CPF informado é do clube. */
export function useClubStatus(document: string | null) {
  return useQuery({
    queryKey: ['club', 'status', document ?? ''],
    queryFn: () => apiRequest<{ isMember: boolean }>(`/club/status/${document}`),
    enabled: !!document,
  })
}

export function useAddClubMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; document: string; validUntil: string }) =>
      apiRequest<ClubMember>('/club/members', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['club', 'members'] }),
  })
}

export function useRemoveClubMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (document: string) => apiRequest<{ removed: boolean }>(`/club/members/${document}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['club', 'members'] }),
  })
}
