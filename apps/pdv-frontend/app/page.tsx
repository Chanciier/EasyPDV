'use client'

import { useAuthStore } from '@/lib/auth-store'
import { LoginScreen } from '@/components/auth/login-screen'
import { ForceChangePasswordScreen } from '@/components/auth/force-change-password-screen'
import { POSProvider } from '@/components/pos/pos-provider'
import { POSShell } from '@/components/pos/pos-shell'

export default function Page() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const mustChangePassword = useAuthStore((s) => s.user?.mustChangePassword)

  if (!isAuthenticated) {
    return <LoginScreen />
  }

  // Troca/reset de senha (2026-08-21) — antes de qualquer tela do PDV, sem
  // jeito de pular/fechar (não é um Modal). Ver force-change-password-screen.tsx.
  if (mustChangePassword) {
    return <ForceChangePasswordScreen />
  }

  return (
    <POSProvider>
      <POSShell />
    </POSProvider>
  )
}
