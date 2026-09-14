'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/auth-store'
import { LoginScreen } from '@/components/auth/login-screen'
import { ForceChangePasswordScreen } from '@/components/auth/force-change-password-screen'
import { POSProvider } from '@/components/pos/pos-provider'
import { POSShell } from '@/components/pos/pos-shell'

/**
 * Build do painel admin (Fase 2, BUILD_TARGET=admin-web) empacota o MESMO
 * pdv-frontend inteiro — inclusive a raiz "/", que é a tela do PDV. No
 * domínio hospedado só pro admin, ninguém deveria ver essa tela (ela nem
 * funciona ali, tentaria falar com 127.0.0.1:4001 que não existe fora do
 * Electron) — achado real: usuário abriu a raiz do domínio do painel e viu
 * "isso só é o PDV em web". Redireciona pra /admin nesse build específico;
 * no build do Electron (sem essa env) a raiz continua sendo o PDV normal.
 */
export default function Page() {
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const mustChangePassword = useAuthStore((s) => s.user?.mustChangePassword)

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_BUILD_TARGET === 'admin-web') {
      router.replace('/admin/')
    }
  }, [router])

  if (process.env.NEXT_PUBLIC_BUILD_TARGET === 'admin-web') {
    return null
  }

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
