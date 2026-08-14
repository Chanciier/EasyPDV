'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ScanBarcode } from 'lucide-react'
import type { AuthTokens, User } from '@easypdv/shared-types'
import { apiRequest, ApiError } from '@/lib/api-client'
import { useAuthStore } from '@/lib/auth-store'

interface LoginResponse {
  user: User
  tokens: AuthTokens
}

export function LoginScreen() {
  const setSession = useAuthStore((s) => s.setSession)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest<LoginResponse>('/auth/login', {
        method: 'POST',
        body: { email, password },
        skipAuth: true,
      }),
    onSuccess: (data) => setSession(data.user, data.tokens),
  })

  const errorMessage =
    mutation.error instanceof ApiError
      ? mutation.error.status === 401
        ? 'E-mail ou senha incorretos.'
        : mutation.error.message
      : mutation.error
        ? 'Não foi possível conectar ao servidor local. Verifique se o backend está rodando.'
        : null

  const submit = () => {
    if (!email || !password || mutation.isPending) return
    mutation.mutate()
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-primary/15">
          <ScanBarcode className="size-7 text-primary-foreground" />
        </div>
        <h1 className="text-center text-xl font-bold">PDV Express</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">Entre com seu usuário para começar.</p>

        <div className="mt-6 space-y-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium">E-mail</label>
            <input
              autoFocus
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="operador@loja.com"
              className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="••••••••"
              className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
            />
          </div>

          {errorMessage && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{errorMessage}</p>
          )}

          <button
            onClick={submit}
            disabled={!email || !password || mutation.isPending}
            className="w-full rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
          >
            {mutation.isPending ? 'Entrando...' : 'Entrar'}
          </button>
        </div>
      </div>
    </div>
  )
}
