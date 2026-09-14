'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, LogOut, MessageCircle, QrCode } from 'lucide-react'
import { useAdminAuthStore } from '@/lib/admin-auth-store'
import { AdminApiError } from '@/lib/admin-api-client'
import { useWhatsappLogout, useWhatsappStatus } from '@/hooks/use-admin-whatsapp'

export default function AdminWhatsappPage() {
  const router = useRouter()
  const isAuthenticated = useAdminAuthStore((s) => s.isAuthenticated)
  const { data: status, isLoading, error } = useWhatsappStatus()
  const logout = useWhatsappLogout()

  useEffect(() => {
    if (!isAuthenticated) router.replace('/admin/login')
  }, [isAuthenticated, router])

  if (!isAuthenticated) return null

  return (
    <div className="flex flex-col items-center p-8">
      <div className="mb-6 flex items-center gap-2 self-start">
        <MessageCircle className="size-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Conexão com WhatsApp</h1>
      </div>

      {error && (
        <p className="mb-4 w-full max-w-md rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error instanceof AdminApiError ? error.message : 'Erro ao consultar status do WhatsApp.'}
        </p>
      )}

      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center">
        {isLoading && <p className="text-sm text-muted-foreground">Consultando status...</p>}

        {!isLoading && status?.connected && (
          <div className="flex flex-col items-center gap-3">
            <CheckCircle2 className="size-12 text-primary-foreground" />
            <p className="font-medium">WhatsApp conectado</p>
            <p className="text-sm text-muted-foreground">
              Os lembretes de renovação do clube já podem ser enviados por aqui.
            </p>
            <button
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              className="mt-2 flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LogOut className="size-4" /> {logout.isPending ? 'Desconectando...' : 'Desconectar'}
            </button>
          </div>
        )}

        {!isLoading && status && !status.connected && !status.qr && (
          <div className="flex flex-col items-center gap-3">
            <QrCode className="size-12 text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">Gerando QR code...</p>
          </div>
        )}

        {!isLoading && status && !status.connected && status.qr && (
          <div className="flex flex-col items-center gap-3">
            {/* data URL — export estático já roda com images.unoptimized, sem next/image aqui */}
            <img src={status.qr} alt="QR code do WhatsApp" className="size-64 rounded-lg border border-border" />
            <p className="text-sm text-muted-foreground">
              Abra o WhatsApp no celular da loja → Aparelhos conectados → Conectar um aparelho, e escaneie o código
              acima.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
