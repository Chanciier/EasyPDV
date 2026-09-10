'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Gift, Trash2, UserCheck, RotateCcw, CheckCircle2, Package } from 'lucide-react'
import type { Product } from '@easypdv/shared-types'
import { formatCpf, onlyDigits, isValidCpf } from '@easypdv/shared-validation'
import { formatBRL } from '@/lib/pos-data'
import { ApiError } from '@/lib/api-client'
import { findProductByBarcode, useProductPrices, useProductSearch } from '@/hooks/use-sales'
import { useGrantStoreCredit, useStoreCreditCustomer, type GrantStoreCreditResult } from '@/hooks/use-store-credit'
import { Modal } from './ui/modal'

interface TrocaItem {
  productId: string
  sku: string
  name: string
  quantity: number
  unitPrice: number
  discountAmount: number
  restock: boolean
}

type Step = 'cpf' | 'customer-info' | 'items'

function describeError(e: unknown, fallback: string): string {
  if (e instanceof ApiError) return e.code
  if (e instanceof Error) return e.message
  return fallback
}

/**
 * Vale-Troca — Fase 2 (2026-09-10). Portão de CPF (sem opção de pular —
 * diferente do CpfGateDialog da Venda, aqui o CPF é obrigatório, é a
 * própria premissa da feature) → nome+telefone só se o cliente for novo →
 * bipagem com desconto manual por item + opção revende/não-revende →
 * finalizar. Estado local ao componente (não sobrevive trocar de aba, ao
 * contrário do carrinho da Venda que usa um store — decisão deliberada de
 * manter simples na primeira versão; ver Fase 2 no cofre Obsidian).
 */
export function StoreCreditView() {
  const [step, setStep] = useState<Step>('cpf')
  const [cpfInput, setCpfInput] = useState('')
  const [document, setDocument] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerInfoError, setCustomerInfoError] = useState<string | null>(null)
  const [items, setItems] = useState<TrocaItem[]>([])
  const [term, setTerm] = useState('')
  const [debouncedTerm, setDebouncedTerm] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [finalizeError, setFinalizeError] = useState<string | null>(null)
  const [result, setResult] = useState<GrantStoreCreditResult | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const cpfDigits = onlyDigits(cpfInput)
  const cpfIsValid = cpfDigits.length === 11 && isValidCpf(cpfDigits)

  const { data: lookup, isFetching: checkingCustomer } = useStoreCreditCustomer(document)
  const grant = useGrantStoreCredit()

  // Assim que o lookup resolve, decide o próximo passo — "CPF já cadastrado
  // → segue direto" ou "CPF novo → pede nome+telefone" (pedido do usuário).
  useEffect(() => {
    if (!lookup || step !== 'cpf') return
    if (lookup.found && lookup.customer) {
      setCustomerName(lookup.customer.name)
      setCustomerPhone(lookup.customer.phone ?? '')
      setStep('items')
    } else {
      setCustomerName('')
      setCustomerPhone('')
      setStep('customer-info')
    }
  }, [lookup, step])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedTerm(term), 250)
    return () => clearTimeout(t)
  }, [term])

  const { data: searchResults = [] } = useProductSearch(debouncedTerm)
  const matches = useMemo(() => searchResults.slice(0, 6), [searchResults])
  const priceQueries = useProductPrices(matches.map((p) => p.id))

  function submitCpf() {
    if (!cpfIsValid) return
    setDocument(cpfDigits)
  }

  function confirmCustomerInfo() {
    if (!customerName.trim() || !customerPhone.trim()) {
      setCustomerInfoError('Informe nome e celular.')
      return
    }
    setCustomerInfoError(null)
    setStep('items')
  }

  function addProduct(product: Product, unitPrice: number) {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id)
      if (existing) {
        return prev.map((i) => (i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i))
      }
      return [
        ...prev,
        { productId: product.id, sku: product.sku, name: product.name, quantity: 1, unitPrice, discountAmount: 0, restock: true },
      ]
    })
    setTerm('')
    searchRef.current?.focus()
  }

  /**
   * Mesma checagem de frescor do term/debouncedTerm de sale-view.tsx — um
   * leitor de código de barras USB digita + Enter mais rápido que os 250ms
   * do debounce, então `matches` ainda pode refletir a última busca por
   * nome antes do scan. Sem essa checagem, o fallback de leitura exata
   * (`findProductByBarcode`) nunca é alcançado. Ver docblock lá pro bug
   * real que isso corrige.
   */
  async function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    const searchIsFresh = debouncedTerm === term.trim()
    if (searchIsFresh && matches.length === 1) {
      const price = priceQueries[0]?.data
      if (price) addProduct(matches[0], price.effectivePrice)
      return
    }
    if (term.trim()) {
      setScanError(null)
      setScanning(true)
      try {
        const { product, price } = await findProductByBarcode(term.trim())
        addProduct(product, price.effectivePrice)
      } catch {
        setScanError('Produto não encontrado.')
      } finally {
        setScanning(false)
      }
    }
  }

  function updateItemDiscount(productId: string, raw: string) {
    const value = Number(raw.replace(',', '.'))
    setItems((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, discountAmount: Number.isNaN(value) ? 0 : Math.max(0, value) } : i)),
    )
  }

  function toggleRestock(productId: string) {
    setItems((prev) => prev.map((i) => (i.productId === productId ? { ...i, restock: !i.restock } : i)))
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((i) => i.productId !== productId))
  }

  function lineTotal(item: TrocaItem): number {
    return Math.max(0, item.quantity * item.unitPrice - item.discountAmount)
  }

  const total = useMemo(() => items.reduce((sum, i) => sum + lineTotal(i), 0), [items])

  async function finalize() {
    if (items.length === 0 || !document) return
    setFinalizeError(null)
    try {
      const res = await grant.mutateAsync({
        document,
        customerName: lookup?.found ? undefined : customerName.trim(),
        customerPhone: lookup?.found ? undefined : customerPhone.trim(),
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          discountAmount: i.discountAmount,
          restock: i.restock,
        })),
      })
      setResult(res)
    } catch (e) {
      setFinalizeError(describeError(e, 'Erro ao gerar o vale-troca.'))
    }
  }

  function reset() {
    setStep('cpf')
    setCpfInput('')
    setDocument(null)
    setCustomerName('')
    setCustomerPhone('')
    setCustomerInfoError(null)
    setItems([])
    setTerm('')
    setScanError(null)
    setFinalizeError(null)
    setResult(null)
  }

  if (step === 'cpf') {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
        <Gift className="size-10 text-muted-foreground" />
        <div>
          <h2 className="text-lg font-semibold">Vale-Troca</h2>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Informe o CPF do cliente pra gerar ou identificar o crédito de troca. Obrigatório — o vale-troca é sempre
            vinculado ao CPF.
          </p>
        </div>
        <div className="w-full max-w-xs space-y-2">
          <input
            autoFocus
            value={cpfInput}
            onChange={(e) => setCpfInput(formatCpf(onlyDigits(e.target.value).slice(0, 11)))}
            onKeyDown={(e) => e.key === 'Enter' && submitCpf()}
            placeholder="000.000.000-00"
            inputMode="numeric"
            disabled={checkingCustomer}
            className="pos-input w-full text-center font-mono text-base"
            aria-label="CPF do cliente"
          />
          {cpfInput && !cpfIsValid && <p className="text-xs text-destructive">CPF inválido.</p>}
        </div>
        <button
          onClick={submitCpf}
          disabled={!cpfIsValid || checkingCustomer}
          className="h-11 w-full max-w-xs rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {checkingCustomer ? 'Verificando…' : 'Continuar'}
        </button>
      </div>
    )
  }

  if (step === 'customer-info') {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
        <UserCheck className="size-10 text-muted-foreground" />
        <div>
          <h2 className="text-lg font-semibold">Cliente novo</h2>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            CPF {formatCpf(document ?? '')} ainda não tem cadastro. Informe nome e celular pra gerar o crédito.
          </p>
        </div>
        <div className="w-full max-w-xs space-y-2">
          <input
            autoFocus
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Nome do cliente"
            className="pos-input w-full"
            aria-label="Nome do cliente"
          />
          <input
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && confirmCustomerInfo()}
            placeholder="Celular"
            className="pos-input w-full"
            aria-label="Celular do cliente"
          />
          {customerInfoError && <p className="text-xs text-destructive">{customerInfoError}</p>}
        </div>
        <div className="flex w-full max-w-xs flex-col gap-2">
          <button
            onClick={confirmCustomerInfo}
            className="h-11 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Continuar
          </button>
          <button
            onClick={() => setStep('cpf')}
            className="h-11 rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
          >
            Voltar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-1 flex-col gap-4 overflow-hidden p-4">
      <div className="flex items-center justify-between rounded-lg border border-border bg-card/50 px-4 py-2.5">
        <div>
          <p className="text-xs text-muted-foreground">Gerando crédito para</p>
          <p className="font-medium">
            {customerName || 'Cliente'} — CPF {formatCpf(document ?? '')}
          </p>
        </div>
        <button onClick={reset} className="text-xs text-muted-foreground underline hover:text-foreground">
          Trocar CPF
        </button>
      </div>

      <div>
        <input
          ref={searchRef}
          autoFocus
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder="Bipar ou buscar produto…"
          disabled={scanning}
          className="pos-input w-full"
          aria-label="Buscar produto pra troca"
        />
        {scanError && <p className="mt-1 text-xs text-destructive">{scanError}</p>}
        {debouncedTerm === term.trim() && matches.length > 1 && (
          <div className="mt-2 divide-y divide-border rounded-lg border border-border bg-card">
            {matches.map((p, idx) => (
              <button
                key={p.id}
                onClick={() => {
                  const price = priceQueries[idx]?.data
                  if (price) addProduct(p, price.effectivePrice)
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <span>{p.name}</span>
                <span className="font-mono text-muted-foreground">
                  {priceQueries[idx]?.data ? formatBRL(priceQueries[idx].data!.effectivePrice) : '…'}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border">
        {items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
            <Package className="size-8" />
            Nenhum produto bipado ainda.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Produto</th>
                <th className="px-3 py-2 text-right font-medium">Qtd</th>
                <th className="px-3 py-2 text-right font-medium">Preço</th>
                <th className="px-3 py-2 text-right font-medium">Desconto (R$)</th>
                <th className="px-3 py-2 text-center font-medium">Revende</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => (
                <tr key={item.productId}>
                  <td className="px-3 py-2">{item.name}</td>
                  <td className="px-3 py-2 text-right font-mono">{item.quantity}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatBRL(item.unitPrice)}</td>
                  <td className="px-3 py-2 text-right">
                    <input
                      value={item.discountAmount || ''}
                      onChange={(e) => updateItemDiscount(item.productId, e.target.value)}
                      placeholder="0,00"
                      inputMode="decimal"
                      className="w-24 rounded-md border border-input bg-background px-2 py-1 text-right font-mono text-sm outline-none focus:border-primary"
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={item.restock}
                      onChange={() => toggleRestock(item.productId)}
                      className="size-4"
                      aria-label={`Devolver ${item.name} ao estoque`}
                    />
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-medium">{formatBRL(lineTotal(item))}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => removeItem(item.productId)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`Remover ${item.name}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
        <div>
          <p className="text-xs text-muted-foreground">Total do crédito</p>
          <p className="font-mono text-xl font-bold">{formatBRL(total)}</p>
        </div>
        <div className="text-right">
          {finalizeError && <p className="mb-1 max-w-xs text-xs text-destructive">{finalizeError}</p>}
          <button
            onClick={finalize}
            disabled={items.length === 0 || grant.isPending}
            className="h-11 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {grant.isPending ? 'Gerando…' : 'Finalizar'}
          </button>
        </div>
      </div>

      <Modal open={!!result} onClose={reset} title="Vale-troca gerado">
        {result && (
          <div className="space-y-3 text-center">
            <CheckCircle2 className="mx-auto size-10 text-emerald-500" />
            <p className="text-sm text-muted-foreground">Crédito gerado com sucesso.</p>
            <p className="font-mono text-2xl font-bold">{formatBRL(result.totalAmount)}</p>
            <p className="text-sm text-muted-foreground">
              Saldo total do cliente agora: <span className="font-medium text-foreground">{formatBRL(result.balance)}</span>
            </p>
            <button
              onClick={reset}
              className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <RotateCcw className="size-4" />
              Nova troca
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}
