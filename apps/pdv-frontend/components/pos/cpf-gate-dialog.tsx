'use client'

import { useState } from 'react'
import { UserCheck } from 'lucide-react'
import { formatCpf, onlyDigits, isValidCpf } from '@easypdv/shared-validation'

/**
 * CPF no início da venda (2026-08-25) — bloqueia a busca de produtos até o
 * operador informar o CPF ou escolher continuar sem. Não usa o componente
 * `Modal` de propósito (mesmo motivo do ForceChangePasswordScreen): Modal
 * sempre fecha com Esc/clique fora, e aqui a escolha precisa ser explícita
 * (mesmo "sem CPF" é uma decisão, não um "fechar sem decidir"). Renderizado
 * inline no lugar da busca, não como overlay por cima dela.
 */
export function CpfGateDialog({
  submitting,
  error,
  onSubmit,
}: {
  submitting: boolean
  error: string | null
  onSubmit: (document: string | null) => void
}) {
  const [cpf, setCpf] = useState('')
  const cpfDigits = onlyDigits(cpf)
  const cpfIsValid = cpfDigits.length === 0 || isValidCpf(cpfDigits)

  const confirm = () => {
    if (!cpfIsValid || submitting) return
    onSubmit(cpfDigits.length > 0 ? cpfDigits : null)
  }

  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
      <UserCheck className="size-10 text-muted-foreground" />
      <div>
        <h2 className="text-lg font-semibold">CPF na nota</h2>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          Informe o CPF do cliente pra identificar clube e emitir a nota fiscal — ou continue sem, e sai só o
          comprovante.
        </p>
      </div>
      <div className="w-full max-w-xs space-y-2">
        <input
          autoFocus
          value={cpf}
          onChange={(e) => setCpf(formatCpf(onlyDigits(e.target.value).slice(0, 11)))}
          onKeyDown={(e) => e.key === 'Enter' && confirm()}
          placeholder="000.000.000-00"
          inputMode="numeric"
          disabled={submitting}
          className="pos-input w-full text-center font-mono text-base"
          aria-label="CPF do cliente"
        />
        {!cpfIsValid && <p className="text-xs text-destructive">CPF inválido.</p>}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <div className="flex w-full max-w-xs flex-col gap-2">
        <button
          onClick={confirm}
          disabled={submitting || !cpfIsValid}
          className="h-11 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Aguarde…' : 'Continuar'}
        </button>
        <button
          onClick={() => !submitting && onSubmit(null)}
          disabled={submitting}
          className="h-11 rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continuar sem CPF
        </button>
      </div>
    </div>
  )
}
