'use client'

import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { ApiError } from '@/lib/api-client'
import { useChangePassword } from '@/hooks/use-auth'
import { useAuthStore } from '@/lib/auth-store'

function describeError(e: unknown, fallback: string) {
  if (e instanceof ApiError) return e.status === 401 ? 'Senha atual incorreta.' : e.code
  if (e instanceof Error) return e.message
  return fallback
}

/**
 * Troca/reset de senha (2026-08-21) — tela cheia, não um Modal (Modal sempre
 * fecha com Esc/clique fora, sem modo "não-dispensável" — ver ui/modal.tsx).
 * Renderizada por app/page.tsx no lugar do POSShell enquanto
 * `user.mustChangePassword` for true — não dá pra pular/fechar até trocar
 * com sucesso. A senha atual é a temporária/padrão que a pessoa já usou pra
 * logar (bootstrap, ou uma senha que um admin acabou de resetar).
 */
export function ForceChangePasswordScreen() {
  const clear = useAuthStore((s) => s.clear)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  const changePassword = useChangePassword()

  const errorMessage =
    validationError ?? (changePassword.error ? describeError(changePassword.error, 'Erro ao trocar a senha.') : null)

  const submit = () => {
    if (changePassword.isPending) return
    if (!currentPassword) {
      setValidationError('Informe a senha atual.')
      return
    }
    if (newPassword.length < 8) {
      setValidationError('A nova senha precisa ter pelo menos 8 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      setValidationError('As senhas não conferem.')
      return
    }
    setValidationError(null)
    changePassword.mutate({ currentPassword, newPassword })
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-primary/15">
          <KeyRound className="size-7 text-primary-foreground" />
        </div>
        <h1 className="text-center text-xl font-bold">Troque sua senha</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Por segurança, escolha uma senha só sua antes de continuar.
        </p>

        <div className="mt-6 space-y-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Senha atual</label>
            <input
              autoFocus
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="••••••••"
              className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Nova senha</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="••••••••"
              className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Confirmar nova senha</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
            disabled={changePassword.isPending}
            className="w-full rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
          >
            {changePassword.isPending ? 'Trocando...' : 'Trocar senha'}
          </button>
          <button
            onClick={clear}
            className="w-full rounded-lg py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Sair
          </button>
        </div>
      </div>
    </div>
  )
}
