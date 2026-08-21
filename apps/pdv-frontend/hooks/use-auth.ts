import { useMutation } from '@tanstack/react-query'
import type { User } from '@easypdv/shared-types'
import { apiRequest } from '@/lib/api-client'
import { useAuthStore } from '@/lib/auth-store'

/** Troca/reset de senha (2026-08-21) — autoatendimento, usuário logado troca a própria senha sabendo a atual. */
export function useChangePassword() {
  const setUser = useAuthStore((s) => s.setUser)
  return useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) =>
      apiRequest<User>('/auth/change-password', { method: 'PATCH', body: input }),
    onSuccess: (user) => setUser(user),
  })
}
