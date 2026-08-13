'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, Plus, Minus, Trash2, ShoppingCart, User, Percent } from 'lucide-react'
import { usePOS } from './pos-provider'
import { formatBRL, normalize, type Product, type Sale, type PaymentMethod } from '@/lib/pos-data'
import { PaymentDialog } from './payment-dialog'
import { ReceiptDialog } from './receipt-dialog'

export function SaleView() {
  const {
    products,
    cart,
    addToCart,
    updateQty,
    removeItem,
    setItemDiscount,
    clearCart,
    subtotal,
    totalDiscount,
    total,
    customers,
    selectedCustomerId,
    setSelectedCustomerId,
    checkout,
  } = usePOS()

  const [term, setTerm] = useState('')
  const [highlight, setHighlight] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [lastSale, setLastSale] = useState<Sale | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const matches = useMemo(() => {
    const t = normalize(term)
    if (!t) return []
    return products
      .filter(
        (p) =>
          normalize(p.name).includes(t) ||
          normalize(p.sku).includes(t) ||
          p.barcode.includes(t),
      )
      .slice(0, 6)
  }, [term, products])

  const addProduct = (p: Product) => {
    addToCart(p)
    setSelectedId(p.id)
    setTerm('')
    setHighlight(0)
    searchRef.current?.focus()
  }

  const handleSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, matches.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (e.nativeEvent.isComposing || e.keyCode === 229) return
      if (matches[highlight]) {
        addProduct(matches[highlight])
      } else if (matches.length === 1) {
        addProduct(matches[0])
      }
    } else if (e.key === 'Escape') {
      e.stopPropagation()
      setTerm('')
    }
  }

  // Atalhos globais da tela de venda
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement

      if (e.key === 'F2') {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
        return
      }
      if (e.key === 'F4') {
        e.preventDefault()
        if (cart.length > 0) setPaymentOpen(true)
        return
      }
      if (typing) return

      if (e.key === 'Escape') {
        if (cart.length > 0) clearCart()
      } else if (e.key === '+' || e.key === '=') {
        const item = cart.find((i) => i.productId === selectedId)
        if (item) updateQty(item.productId, item.qty + 1)
      } else if (e.key === '-') {
        const item = cart.find((i) => i.productId === selectedId)
        if (item) updateQty(item.productId, item.qty - 1)
      } else if (e.key === 'Delete') {
        if (selectedId) removeItem(selectedId)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cart, selectedId, clearCart, updateQty, removeItem])

  const handleConfirmPayment = (method: PaymentMethod, received: number) => {
    const sale = checkout(method, received)
    setPaymentOpen(false)
    if (sale) setLastSale(sale)
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Coluna esquerda: busca + carrinho */}
      <section className="flex min-w-0 flex-1 flex-col p-4">
        {/* Busca */}
        <div className="relative">
          <div className="flex items-center gap-2 rounded-xl border-2 border-primary/40 bg-card px-3 shadow-sm focus-within:border-primary">
            <Search className="size-5 text-muted-foreground" />
            <input
              ref={searchRef}
              autoFocus
              value={term}
              onChange={(e) => {
                setTerm(e.target.value)
                setHighlight(0)
              }}
              onKeyDown={handleSearchKey}
              placeholder="Leia o código de barras ou busque por nome / SKU  —  F2"
              className="h-12 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
              aria-label="Buscar produto"
            />
          </div>

          {matches.length > 0 && (
            <ul className="absolute left-0 right-0 top-14 z-20 overflow-hidden rounded-xl border border-border bg-popover shadow-xl">
              {matches.map((p, i) => (
                <li key={p.id}>
                  <button
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => addProduct(p)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm ${
                      i === highlight ? 'bg-primary/15' : 'hover:bg-muted'
                    }`}
                  >
                    <span className="font-mono text-xs text-muted-foreground">{p.barcode}</span>
                    <span className="flex-1 truncate font-medium">{p.name}</span>
                    <span className="text-xs text-muted-foreground">Est: {p.stock}</span>
                    <span className="font-mono font-semibold">{formatBRL(p.price)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Carrinho */}
        <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
          <div className="grid grid-cols-[1fr_5rem_7rem_6rem_2.5rem] items-center gap-2 border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Produto</span>
            <span className="text-center">Qtd</span>
            <span className="text-right">Preço</span>
            <span className="text-right">Total</span>
            <span />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                <ShoppingCart className="size-10 opacity-30" />
                <p className="text-sm">Nenhum item. Leia um código ou busque (F2).</p>
              </div>
            ) : (
              cart.map((item) => {
                const active = item.productId === selectedId
                const lineTotal = item.price * item.qty - item.discount
                return (
                  <div
                    key={item.productId}
                    onClick={() => setSelectedId(item.productId)}
                    className={`grid cursor-pointer grid-cols-[1fr_5rem_7rem_6rem_2.5rem] items-center gap-2 border-l-2 px-4 py-2.5 text-sm ${
                      active ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-muted/50'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.name}</p>
                      {item.discount > 0 && (
                        <p className="text-xs text-accent">Desc. {formatBRL(item.discount)}</p>
                      )}
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          updateQty(item.productId, item.qty - 1)
                        }}
                        className="grid size-6 place-items-center rounded-md bg-muted text-foreground transition-colors hover:bg-border"
                        aria-label="Diminuir"
                      >
                        <Minus className="size-3" />
                      </button>
                      <span className="w-6 text-center font-mono font-semibold">{item.qty}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          updateQty(item.productId, item.qty + 1)
                        }}
                        className="grid size-6 place-items-center rounded-md bg-muted text-foreground transition-colors hover:bg-border"
                        aria-label="Aumentar"
                      >
                        <Plus className="size-3" />
                      </button>
                    </div>
                    <span className="text-right font-mono text-muted-foreground">
                      {formatBRL(item.price)}
                    </span>
                    <span className="text-right font-mono font-semibold">
                      {formatBRL(lineTotal)}
                    </span>
                    <div className="flex justify-end">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          removeItem(item.productId)
                        }}
                        className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Remover"
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
      </section>

      {/* Coluna direita: cliente + totais */}
      <aside className="flex w-80 shrink-0 flex-col gap-4 border-l border-border bg-card/50 p-4">
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <User className="size-3.5" /> Cliente
          </label>
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {selectedId && (
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Percent className="size-3.5" /> Desconto no item selecionado
            </label>
            <input
              inputMode="decimal"
              value={cart.find((i) => i.productId === selectedId)?.discount || ''}
              onChange={(e) =>
                setItemDiscount(selectedId, Number(e.target.value.replace(',', '.')) || 0)
              }
              placeholder="R$ 0,00"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
            />
          </div>
        )}

        <div className="mt-auto space-y-2 rounded-xl bg-card p-4 shadow-sm ring-1 ring-border">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Subtotal</span>
            <span className="font-mono">{formatBRL(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-accent">
            <span>Descontos</span>
            <span className="font-mono">- {formatBRL(totalDiscount)}</span>
          </div>
          <div className="flex items-baseline justify-between border-t border-border pt-2">
            <span className="text-sm font-semibold">Total</span>
            <span className="font-mono text-3xl font-bold">{formatBRL(total)}</span>
          </div>
          <p className="text-right text-xs text-muted-foreground">
            {cart.reduce((s, i) => s + i.qty, 0)} itens
          </p>
        </div>

        <button
          onClick={() => cart.length > 0 && setPaymentOpen(true)}
          disabled={cart.length === 0}
          className="flex h-16 items-center justify-center gap-2 rounded-xl bg-accent text-lg font-bold text-accent-foreground shadow-lg transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Finalizar
          <kbd className="rounded bg-accent-foreground/20 px-2 py-0.5 font-mono text-sm">F4</kbd>
        </button>
      </aside>

      <PaymentDialog
        open={paymentOpen}
        total={total}
        onClose={() => setPaymentOpen(false)}
        onConfirm={handleConfirmPayment}
      />
      <ReceiptDialog sale={lastSale} onClose={() => setLastSale(null)} />
    </div>
  )
}
