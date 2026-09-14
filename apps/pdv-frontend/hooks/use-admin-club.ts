import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ClubMemberAdmin } from '@easypdv/shared-types'
import { adminApiRequest } from '@/lib/admin-api-client'

export function useAdminClubMembers() {
  return useQuery({
    queryKey: ['admin', 'club', 'members'],
    queryFn: () => adminApiRequest<ClubMemberAdmin[]>('/admin/club/members'),
  })
}

export function useSetWhatsappConsent() {
  const queryClient = useQueryClient()
  return useMutation({
    // Resposta é o Customer atualizado (não um ClubMemberAdmin) — a tela não
    // usa o corpo da resposta, só invalida e deixa a lista buscar de novo.
    mutationFn: ({ document, consent }: { document: string; consent: boolean }) =>
      adminApiRequest<unknown>(`/admin/club/members/${document}/whatsapp-consent`, {
        method: 'PATCH',
        body: { consent },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'club', 'members'] }),
  })
}
