'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, Plus, Pencil, Trash2, Package } from 'lucide-react'
import type { Product } from '@easypdv/shared-types'
import { formatBRL } from '@/lib/pos-data'
import { ApiError } from '@/lib/api-client'
import { useProductPrices } from '@/hooks/use-sales'
import {
  useActivePriceList,
  useAddBarcode,
  useCategories,
  useCreateCategory,
  useCreateProduct,
  useProductList,
  useProductPrice,
  useSetPrice,
  useUpdateProduct,
} from '@/hooks/use-catalog'
import { Modal } from './ui/modal'

interface ProductForm {
  sku: string
  name: string
  categoryId: string
  unit: string
  active: boolean
  price: string
  newBarcode: string
}

const emptyForm: ProductForm = {
  sku: '',
  name: '',
  categoryId: '',
  unit: 'un',
  active: true,
  price: '',
  newBarcode: '',
}

function describeError(e: unknown, fallback: string) {
  if (e instanceof ApiError) return e.code
  if (e instanceof Error) return e.message
  return fallback
}

export function ProductsView() {
  const [term, setTerm] = useState('')
  const [debouncedTerm, setDebouncedTerm] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedTerm(term), 250)
    return () => clearTimeout(t)
  }, [term])

  const { data: products = [], isLoading } = useProductList(debouncedTerm)
  const { data: categories = [] } = useCategories()
  const { data: activePriceList } = useActivePriceList()

  const priceQueries = useProductPrices(products.map((p) => p.id))
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])

  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<ProductForm>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null)

  const editingPrice = useProductPrice(editingProduct?.id ?? null)
  const createCategory = useCreateCategory()
  const createProduct = useCreateProduct()
  const updateProduct = useUpdateProduct()
  const addBarcode = useAddBarcode()
  const setPrice = useSetPrice()

  useEffect(() => {
    if (!editingProduct) return
    if (editingPrice.data) {
      setForm((f) => ({ ...f, price: String(editingPrice.data.effectivePrice) }))
    } else if (editingPrice.isError) {
      setForm((f) => ({ ...f, price: '' }))
    }
  }, [editingProduct, editingPrice.data, editingPrice.isError])

  const openNew = () => {
    setForm(emptyForm)
    setFormError(null)
    setNewCategoryName('')
    setCreating(true)
  }

  const openEdit = (p: Product) => {
    setForm({
      sku: p.sku,
      name: p.name,
      categoryId: p.categoryId ?? '',
      unit: p.unit,
      active: p.active,
      price: '',
      newBarcode: '',
    })
    setFormError(null)
    setNewCategoryName('')
    setEditingProduct(p)
  }

  const closeModal = () => {
    setCreating(false)
    setEditingProduct(null)
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

  async function handleCreateCategory() {
    const name = newCategoryName.trim()
    if (!name) return
    try {
      const category = await createCategory.mutateAsync({ name })
      setForm((f) => ({ ...f, categoryId: category.id }))
      setNewCategoryName('')
    } catch (e) {
      setFormError(describeError(e, 'Erro ao criar categoria.'))
    }
  }

  async function submit() {
    if (!form.name.trim()) return
    setFormError(null)
    setSubmitting(true)
    try {
      const priceNum = Number(form.price.replace(',', '.')) || 0

      if (creating) {
        if (!form.sku.trim()) {
          setFormError('Informe o SKU.')
          return
        }
        const product = await createProduct.mutateAsync({
          sku: form.sku.trim(),
          name: form.name.trim(),
          categoryId: form.categoryId || undefined,
          unit: form.unit.trim() || 'un',
        })
        if (form.newBarcode.trim()) {
          await addBarcode.mutateAsync({ productId: product.id, code: form.newBarcode.trim() })
        }
        if (priceNum > 0 && activePriceList) {
          await setPrice.mutateAsync({ priceListId: activePriceList.id, productId: product.id, price: priceNum })
        }
      } else if (editingProduct) {
        await updateProduct.mutateAsync({
          id: editingProduct.id,
          data: {
            name: form.name.trim(),
            categoryId: form.categoryId || null,
            unit: form.unit.trim() || 'un',
            active: form.active,
          },
        })
        if (priceNum > 0 && activePriceList) {
          await setPrice.mutateAsync({
            priceListId: activePriceList.id,
            productId: editingProduct.id,
            price: priceNum,
          })
        }
        if (form.newBarcode.trim()) {
          await addBarcode.mutateAsync({ productId: editingProduct.id, code: form.newBarcode.trim() })
        }
      }
      closeModal()
    } catch (e) {
      setFormError(describeError(e, 'Erro ao salvar produto.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function deactivate() {
    if (!confirmDelete) return
    setSubmitting(true)
    try {
      await updateProduct.mutateAsync({ id: confirmDelete.id, data: { active: false } })
      setConfirmDelete(null)
    } catch (e) {
      setFormError(describeError(e, 'Erro ao desativar produto.'))
      setConfirmDelete(null)
    } finally {
      setSubmitting(false)
    }
  }

  const modalOpen = creating || editingProduct !== null

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Buscar produto por nome ou SKU"
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
          <span>SKU</span>
          <span>Produto</span>
          <span>Categoria</span>
          <span>Unidade</span>
          <span className="text-right">Preço</span>
          <span className="text-right">Ações</span>
        </div>
        <div className="h-full overflow-y-auto pb-16">
          {!isLoading && products.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Package className="size-8 opacity-30" />
              <p className="text-sm">Nenhum produto encontrado.</p>
            </div>
          ) : (
            products.map((p, i) => {
              const price = priceQueries[i]?.data
              return (
                <div
                  key={p.id}
                  className="grid grid-cols-[8rem_1fr_9rem_6rem_6rem_5rem] items-center gap-3 border-b border-border/60 px-4 py-2.5 text-sm hover:bg-muted/50"
                >
                  <span className="font-mono text-xs text-muted-foreground">{p.sku}</span>
                  <span className="truncate font-medium">{p.name}</span>
                  <span className="truncate text-muted-foreground">
                    {p.categoryId ? (categoryById.get(p.categoryId) ?? '—') : '—'}
                  </span>
                  <span className="text-muted-foreground">{p.unit}</span>
                  <span className="text-right font-mono font-semibold">
                    {price ? formatBRL(price.effectivePrice) : '—'}
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
                      onClick={() => setConfirmDelete(p)}
                      className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Desativar"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Modal novo/editar */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={creating ? 'Novo produto' : 'Editar produto'}
        footer={
          <>
            <button
              onClick={closeModal}
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome" className="col-span-2">
            <input
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="pos-input"
            />
          </Field>
          <Field label="SKU">
            <input
              value={form.sku}
              disabled={!creating}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              className="pos-input font-mono disabled:opacity-50"
            />
          </Field>
          <Field label="Unidade">
            <input
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className="pos-input font-mono"
            />
          </Field>
          <Field label="Categoria" className="col-span-2">
            <div className="flex gap-2">
              <select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                className="pos-input flex-1"
              >
                <option value="">Nenhuma</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-1.5 flex gap-2">
              <input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Nova categoria"
                className="pos-input flex-1 text-xs"
              />
              <button
                onClick={handleCreateCategory}
                disabled={!newCategoryName.trim() || createCategory.isPending}
                className="shrink-0 rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                Criar
              </button>
            </div>
          </Field>
          <Field label={`Preço${activePriceList ? '' : ' (sem tabela ativa)'}`}>
            <input
              inputMode="decimal"
              value={form.price}
              disabled={!activePriceList}
              onChange={(e) => setForm({ ...form, price: e.target.value.replace(',', '.') })}
              placeholder={!creating && editingPrice.isLoading ? '…' : 'R$ 0,00'}
              className="pos-input font-mono disabled:opacity-50"
            />
          </Field>
          <Field label={creating ? 'Código de barras' : 'Adicionar código de barras'}>
            <input
              value={form.newBarcode}
              onChange={(e) => setForm({ ...form, newBarcode: e.target.value })}
              className="pos-input font-mono"
            />
          </Field>
          {!creating && (
            <label className="col-span-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Produto ativo
            </label>
          )}
        </div>
        {formError && (
          <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</p>
        )}
      </Modal>

      {/* Confirmar desativação */}
      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Desativar produto"
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
              onClick={deactivate}
              disabled={submitting}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Desativar
            </button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          O produto deixa de aparecer na busca de venda e nesta lista. O histórico de vendas já
          confirmadas não é afetado. Não é possível excluir um produto definitivamente.
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
