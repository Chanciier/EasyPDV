import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { User, UserRole } from '@easypdv/shared-types'
import { apiRequest } from '@/lib/api-client'

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => apiRequest<User[]>('/users'),
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; email: string; password: string; role: UserRole }) =>
      apiRequest<User>('/users', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })
}

/** Reset por admin (2026-08-21) — admin não precisa saber a senha atual do outro usuário; força troca no próximo login dele. */
export function useResetUserPassword() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { userId: string; newPassword: string }) =>
      apiRequest<User>(`/users/${input.userId}/reset-password`, { method: 'PATCH', body: { newPassword: input.newPassword } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })
}
