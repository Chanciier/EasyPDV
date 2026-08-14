'use client'

import { useAuthStore } from '@/lib/auth-store'
import { LoginScreen } from '@/components/auth/login-screen'
import { POSProvider } from '@/components/pos/pos-provider'
import { POSShell } from '@/components/pos/pos-shell'

export default function Page() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  if (!isAuthenticated) {
    return <LoginScreen />
  }

  return (
    <POSProvider>
      <POSShell />
    </POSProvider>
  )
}
