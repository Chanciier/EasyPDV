'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, Plus, Pencil, Trash2, Users } from 'lucide-react'
import { usePOS } from './pos-provider'
import { uid, normalize, type Customer } from '@/lib/pos-data'
import { Modal } from './ui/modal'

const empty: Customer = { id: '', name: '', doc: '', phone: '' }

export function CustomersView() {
  const { customers, saveCustomer, deleteCustomer } = usePOS()
  const [term, setTerm] = useState('')
  const [editing, setEditing] = useState<Customer | null>(null)
  const [form, setForm] = useState<Customer>(empty)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const t = normalize(term)
    if (!t) return customers
    return customers.filter(
      (c) =>
        normalize(c.name).includes(t) ||
        normalize(c.doc).includes(t) ||
        normalize(c.phone).includes(t),
    )
  }, [term, customers])

  const openNew = () => {
    const fresh = { ...empty, id: uid('c') }
    setForm(fresh)
    setEditing(fresh)
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

  const submit = () => {
    if (!form.name.trim()) return
    saveCustomer(form)
    setEditing(null)
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
          {filtered.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Users className="size-8 opacity-30" />
              <p className="text-sm">Nenhum cliente encontrado.</p>
            </div>
          ) : (
            filtered.map((c) => (
              <div
                key={c.id}
                className="grid grid-cols-[1fr_12rem_10rem_5rem] items-center gap-3 border-b border-border/60 px-4 py-2.5 text-sm hover:bg-muted/50"
              >
                <span className="truncate font-medium">{c.name}</span>
                <span className="font-mono text-muted-foreground">{c.doc || '—'}</span>
                <span className="text-muted-foreground">{c.phone || '—'}</span>
                <div className="flex justify-end gap-1">
                  <button
                    onClick={() => {
                      setForm(c)
                      setEditing(c)
                    }}
                    className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Editar"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(c.id)}
                    disabled={c.id === 'c1'}
                    className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
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
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={customers.some((c) => c.id === form.id) ? 'Editar cliente' : 'Novo cliente'}
        size="sm"
        footer={
          <>
            <button
              onClick={() => setEditing(null)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              onClick={submit}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Salvar
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
              value={form.doc}
              onChange={(e) => setForm({ ...form, doc: e.target.value })}
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
              onClick={() => {
                if (confirmDelete) deleteCustomer(confirmDelete)
                setConfirmDelete(null)
              }}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/90"
            >
              Excluir
            </button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Deseja realmente excluir este cliente?
        </p>
      </Modal>
    </div>
  )
}
