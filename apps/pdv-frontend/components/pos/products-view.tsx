'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, Plus, Pencil, Trash2, Package } from 'lucide-react'
import { usePOS } from './pos-provider'
import { formatBRL, uid, normalize, type Product } from '@/lib/pos-data'
import { Modal } from './ui/modal'

const empty: Product = {
  id: '',
  sku: '',
  barcode: '',
  name: '',
  price: 0,
  stock: 0,
  category: '',
}

export function ProductsView() {
  const { products, saveProduct, deleteProduct } = usePOS()
  const [term, setTerm] = useState('')
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState<Product>(empty)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const t = normalize(term)
    if (!t) return products
    return products.filter(
      (p) =>
        normalize(p.name).includes(t) ||
        normalize(p.sku).includes(t) ||
        p.barcode.includes(t) ||
        normalize(p.category).includes(t),
    )
  }, [term, products])

  const openNew = () => {
    setForm({ ...empty, id: uid('p') })
    setEditing({ ...empty, id: uid('p') })
  }

  const openEdit = (p: Product) => {
    setForm(p)
    setEditing(p)
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
    saveProduct(form)
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
            placeholder="Buscar produto, SKU, código ou categoria"
            className="h-10 w-full bg-transparent text-sm outline-none"
          />
        </div>
        <button
          onClick={openNew}
          className="flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="size-4" /> Novo produto
          <kbd className="rounded bg-primary-foreground/20 px-1 font-mono text-[10px]">F2</kbd>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid grid-cols-[8rem_1fr_9rem_6rem_6rem_5rem] items-center gap-3 border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Código</span>
          <span>Produto</span>
          <span>Categoria</span>
          <span className="text-right">Preço</span>
          <span className="text-right">Estoque</span>
          <span className="text-right">Ações</span>
        </div>
        <div className="h-full overflow-y-auto pb-16">
          {filtered.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Package className="size-8 opacity-30" />
              <p className="text-sm">Nenhum produto encontrado.</p>
            </div>
          ) : (
            filtered.map((p) => (
              <div
                key={p.id}
                className="grid grid-cols-[8rem_1fr_9rem_6rem_6rem_5rem] items-center gap-3 border-b border-border/60 px-4 py-2.5 text-sm hover:bg-muted/50"
              >
                <span className="font-mono text-xs text-muted-foreground">{p.barcode}</span>
                <span className="truncate font-medium">{p.name}</span>
                <span className="text-muted-foreground">{p.category}</span>
                <span className="text-right font-mono font-semibold">{formatBRL(p.price)}</span>
                <span
                  className={`text-right font-mono ${p.stock <= 10 ? 'font-bold text-accent' : ''}`}
                >
                  {p.stock}
                </span>
                <div className="flex justify-end gap-1">
                  <button
                    onClick={() => openEdit(p)}
                    className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Editar"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(p.id)}
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

      {/* Modal novo/editar */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={products.some((p) => p.id === form.id) ? 'Editar produto' : 'Novo produto'}
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome" className="col-span-2">
            <input
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="pos-input"
            />
          </Field>
          <Field label="Código de barras">
            <input
              value={form.barcode}
              onChange={(e) => setForm({ ...form, barcode: e.target.value })}
              className="pos-input font-mono"
            />
          </Field>
          <Field label="SKU">
            <input
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              className="pos-input font-mono"
            />
          </Field>
          <Field label="Categoria">
            <input
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="pos-input"
            />
          </Field>
          <Field label="Preço (R$)">
            <input
              inputMode="decimal"
              value={form.price || ''}
              onChange={(e) =>
                setForm({ ...form, price: Number(e.target.value.replace(',', '.')) || 0 })
              }
              className="pos-input font-mono"
            />
          </Field>
          <Field label="Estoque">
            <input
              inputMode="numeric"
              value={form.stock || ''}
              onChange={(e) => setForm({ ...form, stock: Number(e.target.value) || 0 })}
              className="pos-input font-mono"
            />
          </Field>
        </div>
      </Modal>

      {/* Confirmar exclusão */}
      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Excluir produto"
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
                if (confirmDelete) deleteProduct(confirmDelete)
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
          Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.
        </p>
      </Modal>
    </div>
  )
}

function Field({
  label,
  children,
  className = '',
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
    </label>
  )
}
