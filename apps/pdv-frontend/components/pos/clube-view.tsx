'use client'

import { useState } from 'react'
import { Search, Plus, Trash2, Award } from 'lucide-react'
import { formatCpf, onlyDigits, isValidCpf } from '@easypdv/shared-validation'
import { ApiError } from '@/lib/api-client'
import { useAddClubMember, useClubMembers, useRemoveClubMember } from '@/hooks/use-club'
import { Modal } from './ui/modal'

type FormState = { name: string; document: string; validUntil: string }
const emptyForm: FormState = { name: '', document: '', validUntil: '' }

function formatDate(iso: string | null): string {
  if (!iso) return 'validade desconhecida'
  return new Date(iso).toLocaleDateString('pt-BR')
}

export function ClubeView() {
  const [term, setTerm] = useState('')
  const { data: members = [], isLoading } = useClubMembers()
  const addMember = useAddClubMember()
  const removeMember = useRemoveClubMember()

  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)

  const filtered = members.filter((m) => {
    const t = term.trim().toLowerCase()
    if (!t) return true
    return m.name.toLowerCase().includes(t) || m.document.includes(onlyDigits(t))
  })

  const openNew = () => {
    setForm(emptyForm)
    setFormError(null)
    setAdding(true)
  }

  const submit = async () => {
    const name = form.name.trim()
    const documentDigits = onlyDigits(form.document)
    if (!name) {
      setFormError('Informe o nome.')
      return
    }
    if (!isValidCpf(documentDigits)) {
      setFormError('CPF inválido.')
      return
    }
    if (!form.validUntil) {
      setFormError('Informe a validade.')
      return
    }
    setFormError(null)
    try {
      await addMember.mutateAsync({ name, document: documentDigits, validUntil: new Date(form.validUntil).toISOString() })
      setAdding(false)
    } catch (e) {
      setFormError(e instanceof ApiError ? e.code : e instanceof Error ? e.message : 'Erro ao adicionar ao clube.')
    }
  }

  const confirmRemoveMember = async () => {
    if (!confirmRemove) return
    try {
      await removeMember.mutateAsync(confirmRemove)
    } finally {
      setConfirmRemove(null)
    }
  }

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Buscar membro por nome ou CPF"
            className="h-10 w-full bg-transparent text-sm outline-none"
          />
        </div>
        <button
          onClick={openNew}
          className="flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="size-4" /> Adicionar ao clube
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid grid-cols-[1fr_12rem_10rem_4rem] items-center gap-3 border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Nome</span>
          <span>CPF</span>
          <span>Validade</span>
          <span className="text-right">Ações</span>
        </div>
        <div className="h-full overflow-y-auto pb-16">
          {!isLoading && filtered.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Award className="size-8 opacity-30" />
              <p className="text-sm">Nenhum membro do clube encontrado.</p>
            </div>
          ) : (
            filtered.map((m) => (
              <div
                key={m.document}
                className="grid grid-cols-[1fr_12rem_10rem_4rem] items-center gap-3 border-b border-border/60 px-4 py-2.5 text-sm hover:bg-muted/50"
              >
                <span className="truncate font-medium">{m.name}</span>
                <span className="font-mono text-muted-foreground">{formatCpf(m.document)}</span>
                <span className="text-muted-foreground">{formatDate(m.validUntil)}</span>
                <div className="flex justify-end">
                  <button
                    onClick={() => setConfirmRemove(m.document)}
                    className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Remover"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Adicionar ao clube"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setAdding(false)}
              disabled={addMember.isPending}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={submit}
              disabled={addMember.isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {addMember.isPending ? 'Salvando…' : 'Adicionar'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Nome</span>
            <input
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="pos-input"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">CPF</span>
            <input
              value={form.document}
              onChange={(e) => setForm({ ...form, document: formatCpf(onlyDigits(e.target.value).slice(0, 11)) })}
              placeholder="000.000.000-00"
              inputMode="numeric"
              className="pos-input font-mono"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Validade</span>
            <input
              type="date"
              value={form.validUntil}
              onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
              className="pos-input"
            />
          </label>
          {formError && <p className="text-xs text-destructive">{formError}</p>}
        </div>
      </Modal>

      <Modal
        open={confirmRemove !== null}
        onClose={() => setConfirmRemove(null)}
        title="Remover do clube"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setConfirmRemove(null)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              onClick={confirmRemoveMember}
              disabled={removeMember.isPending}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Remover
            </button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Remover do clube tira o desconto de 30% dessa pessoa. Pra renovar a validade, remova e adicione de novo.
        </p>
      </Modal>
    </div>
  )
}
