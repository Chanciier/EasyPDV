import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ClubMemberAdmin } from '@easypdv/shared-types'
import { adminApiRequest } from '@/lib/admin-api-client'

export function useAdminClubMembers() {
  return useQuery({
    queryKey: ['admin', 'club', 'members'],
    queryFn: () => adminApiRequest<ClubMemberAdmin[]>('/admin/club/members'),
  })
}

/** Disparo manual do motor de lembrete (2026-09-14) — sem @Cron automático de propósito, ver SweepClubRemindersUseCase. */
export function useSweepClubReminders() {
  return useMutation({
    mutationFn: () => adminApiRequest<{ enqueued: number; skipped: number }>('/admin/club-reminders/sweep', { method: 'POST' }),
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
