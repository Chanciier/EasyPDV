'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Award, MessageCircle, MessageCircleOff, PlayCircle } from 'lucide-react'
import { formatCpf } from '@easypdv/shared-validation'
import { useAdminAuthStore } from '@/lib/admin-auth-store'
import { AdminApiError } from '@/lib/admin-api-client'
import { useAdminClubMembers, useSetWhatsappConsent, useSweepClubReminders } from '@/hooks/use-admin-club'

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR')
}

export default function AdminClubePage() {
  const router = useRouter()
  const isAuthenticated = useAdminAuthStore((s) => s.isAuthenticated)
  const { data: members, isLoading, error } = useAdminClubMembers()
  const setConsent = useSetWhatsappConsent()
  const sweep = useSweepClubReminders()
  const [sweepMessage, setSweepMessage] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    if (!isAuthenticated) router.replace('/admin/login')
  }, [isAuthenticated, router])

  if (!isAuthenticated) return null

  const runSweep = async () => {
    setSweepMessage(null)
    try {
      const result = await sweep.mutateAsync()
      setSweepMessage({
        ok: true,
        text: `Varredura concluída: ${result.enqueued} lembrete(s) enfileirado(s), ${result.skipped} já enviado(s) antes.`,
      })
    } catch (e) {
      setSweepMessage({ ok: false, text: e instanceof AdminApiError ? e.message : 'Falha ao rodar a varredura.' })
    }
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Award className="size-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Sócios do Clube — telefone e consentimento de WhatsApp</h1>
        </div>
        <button
          onClick={runSweep}
          disabled={sweep.isPending}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <PlayCircle className="size-3.5" /> {sweep.isPending ? 'Rodando...' : 'Rodar varredura de lembretes agora'}
        </button>
      </div>

      {sweepMessage && (
        <p
          className={`mb-4 rounded-lg px-3 py-2 text-sm ${
            sweepMessage.ok ? 'bg-emerald-500/10 text-emerald-600' : 'bg-destructive/10 text-destructive'
          }`}
        >
          {sweepMessage.text}
        </p>
      )}

      {error && (
        <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error instanceof AdminApiError ? error.message : 'Erro ao carregar sócios.'}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid grid-cols-[1fr_10rem_8rem_10rem_12rem_10rem] items-center gap-3 border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Nome</span>
          <span>CPF</span>
          <span>Validade</span>
          <span>Telefone</span>
          <span>Consentimento</span>
          <span className="text-right">Ação</span>
        </div>
        <div className="pb-4">
          {isLoading && <p className="p-4 text-sm text-muted-foreground">Carregando...</p>}
          {!isLoading && !error && (members?.length ?? 0) === 0 && (
            <p className="p-4 text-sm text-muted-foreground">Nenhum sócio encontrado.</p>
          )}
          {members?.map((m) => {
            const canReceive = !!m.whatsappConsentAt && !m.whatsappOptOutAt
            return (
              <div
                key={m.document}
                className="grid grid-cols-[1fr_10rem_8rem_10rem_12rem_10rem] items-center gap-3 border-b border-border/60 px-4 py-2.5 text-sm hover:bg-muted/50"
              >
                <span className="truncate font-medium">{m.name}</span>
                <span className="font-mono text-muted-foreground">{formatCpf(m.document)}</span>
                <span className="text-muted-foreground">{formatDate(m.validUntil)}</span>
                <span className="font-mono text-muted-foreground">{m.phone ?? '—'}</span>
                <span className={canReceive ? 'text-primary-foreground' : 'text-muted-foreground'}>
                  {canReceive
                    ? `Sim, desde ${formatDateTime(m.whatsappConsentAt)}`
                    : m.whatsappOptOutAt
                      ? `Não, desde ${formatDateTime(m.whatsappOptOutAt)}`
                      : 'Nunca perguntado'}
                </span>
                <div className="flex justify-end">
                  <button
                    onClick={() => setConsent.mutate({ document: m.document, consent: !canReceive })}
                    disabled={setConsent.isPending}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {canReceive ? (
                      <>
                        <MessageCircleOff className="size-3.5" /> Desativar
                      </>
                    ) : (
                      <>
                        <MessageCircle className="size-3.5" /> Ativar
                      </>
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
