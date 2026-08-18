'use client'

import { useState } from 'react'
import { KeyRound, Copy } from 'lucide-react'
import type { ActivationCodeResult } from '@easypdv/shared-types'
import { ApiError } from '@/lib/api-client'
import { useGenerateActivationCode } from '@/hooks/use-provisioning'

function describeError(e: unknown, fallback: string) {
  if (e instanceof ApiError) return e.code
  if (e instanceof Error) return e.message
  return fallback
}

export function AdminActivationTab() {
  const [result, setResult] = useState<ActivationCodeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const generate = useGenerateActivationCode()

  const submit = async () => {
    setError(null)
    setResult(null)
    try {
      const code = await generate.mutateAsync()
      setResult(code)
    } catch (e) {
      setError(describeError(e, 'Falha ao gerar código de ativação.'))
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-md flex-col justify-center gap-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <KeyRound className="size-5" />
        <p className="text-sm">
          Gere um código de ativação pra instalar o PDV num terminal novo desta MESMA loja. O catálogo do Bling é
          importado automaticamente assim que o terminal for ativado.
        </p>
      </div>

      <button
        onClick={submit}
        disabled={generate.isPending}
        className="flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {generate.isPending ? 'Gerando…' : 'Gerar código pra novo terminal'}
      </button>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {result && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Código de ativação para &quot;{result.storeName}&quot;
          </p>
          <div className="flex items-center gap-2">
            <span className="flex-1 select-all rounded-md bg-card px-3 py-2 font-mono text-lg font-bold tracking-wider">
              {result.code}
            </span>
            <button
              onClick={() => navigator.clipboard.writeText(result.code)}
              title="Copiar código"
              className="grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Copy className="size-4" />
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Expira em {new Date(result.expiresAt).toLocaleString('pt-BR')}. Digite este código na tela de ativação
            do novo terminal.
          </p>
        </div>
      )}
    </div>
  )
}
