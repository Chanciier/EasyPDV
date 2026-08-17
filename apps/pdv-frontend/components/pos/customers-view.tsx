'use client'

import { useEffect, useState } from 'react'
import { Search, Plus, Pencil, Trash2, Users } from 'lucide-react'
import type { Customer } from '@easypdv/shared-types'
import { ApiError } from '@/lib/api-client'
import { useCreateCustomer, useCustomerSearch, useDeleteCustomer, useUpdateCustomer } from '@/hooks/use-customers'
import { Modal } from './ui/modal'

type FormState = { name: string; document: string; phone: string; email: string }
const emptyForm: FormState = { name: '', document: '', phone: '', email: '' }

export function CustomersView() {
  const [term, setTerm] = useState('')
  const [debouncedTerm, setDebouncedTerm] = useState('')
  const { data: customers = [], isLoading } = useCustomerSearch(debouncedTerm)
  const createCustomer = useCreateCustomer()
  const updateCustomer = useUpdateCustomer()
  const deleteCustomer = useDeleteCustomer()

  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedTerm(term), 250)
    return () => clearTimeout(t)
  }, [term])

  const openNew = () => {
    setForm(emptyForm)
    setFormError(null)
    setEditingId('new')
  }

  const openEdit = (c: Customer) => {
    setForm({ name: c.name, document: c.document ?? '', phone: c.phone ?? '', email: c.email ?? '' })
    setFormError(null)
    setEditingId(c.id)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing =
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      if (e.key === 'F2' && !typing) {
        e.preventDefault()
        openNew()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const submitting = createCustomer.isPending || updateCustomer.isPending

  const submit = async () => {
    const name = form.name.trim()
    if (!name) {
      setFormError('Informe o nome.')
      return
    }
    setFormError(null)
    try {
      if (editingId === 'new') {
        await createCustomer.mutateAsync({
          name,
          document: form.document.trim() || undefined,
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
        })
      } else if (editingId) {
        await updateCustomer.mutateAsync({
          id: editingId,
          data: {
            name,
            document: form.document.trim() || null,
            phone: form.phone.trim() || null,
            email: form.email.trim() || null,
          },
        })
      }
      setEditingId(null)
    } catch (e) {
      setFormError(e instanceof ApiError ? e.code : e instanceof Error ? e.message : 'Erro ao salvar cliente.')
    }
  }

  const confirmDeleteCustomer = async () => {
    if (!confirmDelete) return
    try {
      await deleteCustomer.mutateAsync(confirmDelete)
    } finally {
      setConfirmDelete(null)
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
            placeholder="Buscar cliente, CPF/CNPJ ou telefone"
            className="h-10 w-full bg-transparent text-sm outline-none"
          />
        </div>
        <button
          onClick={openNew}
          className="flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="size-4" /> Novo cliente
          <kbd className="rounded bg-primary-foreground/20 px-1 font-mono text-[10px]">F2</kbd>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid grid-cols-[1fr_12rem_10rem_5rem] items-center gap-3 border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Nome</span>
          <span>CPF / CNPJ</span>
          <span>Telefone</span>
          <span className="text-right">Ações</span>
        </div>
        <div className="h-full overflow-y-auto pb-16">
          {!isLoading && customers.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Users className="size-8 opacity-30" />
              <p className="text-sm">Nenhum cliente encontrado.</p>
            </div>
          ) : (
            customers.map((c) => (
              <div
                key={c.id}
                className="grid grid-cols-[1fr_12rem_10rem_5rem] items-center gap-3 border-b border-border/60 px-4 py-2.5 text-sm hover:bg-muted/50"
              >
                <span className="truncate font-medium">{c.name}</span>
                <span className="font-mono text-muted-foreground">{c.document || '—'}</span>
                <span className="text-muted-foreground">{c.phone || '—'}</span>
                <div className="flex justify-end gap-1">
                  <button
                    onClick={() => openEdit(c)}
                    className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Editar"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(c.id)}
                    className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Excluir"
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
        open={editingId !== null}
        onClose={() => setEditingId(null)}
        title={editingId === 'new' ? 'Novo cliente' : 'Editar cliente'}
        size="sm"
        footer={
          <>
            <button
              onClick={() => setEditingId(null)}
              disabled={submitting}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={submit}
              disabled={submitting}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Salvando…' : 'Salvar'}
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
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              className="pos-input"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">CPF / CNPJ</span>
            <input
              value={form.document}
              onChange={(e) => setForm({ ...form, document: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              className="pos-input font-mono"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Telefone</span>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              className="pos-input font-mono"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">E-mail</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              className="pos-input"
            />
          </label>
          {formError && <p className="text-xs text-destructive">{formError}</p>}
        </div>
      </Modal>

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Excluir cliente"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setConfirmDelete(null)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              onClick={confirmDeleteCustomer}
              disabled={deleteCustomer.isPending}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Excluir
            </button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Deseja realmente excluir este cliente? Vendas já feitas por ele continuam no histórico, sem cliente vinculado.
        </p>
      </Modal>
    </div>
  )
}
