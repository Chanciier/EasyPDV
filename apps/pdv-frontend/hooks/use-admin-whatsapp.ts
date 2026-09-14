import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApiRequest } from '@/lib/admin-api-client'

interface WhatsappStatus {
  connected: boolean
  qr: string | null
}

/** Poll a cada 3s enquanto não conectado — o QR muda e a conexão pode fechar a qualquer momento assim que o admin escaneia. Para de repetir assim que `connected` vira true. */
export function useWhatsappStatus() {
  return useQuery({
    queryKey: ['admin', 'whatsapp', 'status'],
    queryFn: () => adminApiRequest<WhatsappStatus>('/admin/whatsapp/status'),
    refetchInterval: (query) => (query.state.data?.connected ? false : 3000),
  })
}

export function useWhatsappLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => adminApiRequest<{ success: boolean }>('/admin/whatsapp/logout', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'whatsapp', 'status'] }),
  })
}
