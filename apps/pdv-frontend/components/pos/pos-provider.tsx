'use client'

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  type CashMovement,
  type CashSession,
  type CartItem,
  type Customer,
  type PaymentMethod,
  type Product,
  type Sale,
  seedCustomers,
  seedProducts,
  uid,
  normalize,
} from '@/lib/pos-data'

type View = 'venda' | 'caixa' | 'produtos' | 'historico' | 'clientes' | 'auditoria'

type POSContextValue = {
  // navegação
  view: View
  setView: (v: View) => void
  operator: string

  // dados
  products: Product[]
  customers: Customer[]
  sales: Sale[]
  cashSession: CashSession | null

  // carrinho
  cart: CartItem[]
  selectedCustomerId: string
  setSelectedCustomerId: (id: string) => void
  addToCart: (product: Product, qty?: number) => void
  addByCode: (code: string) => Product | null
  updateQty: (productId: string, qty: number) => void
  setItemDiscount: (productId: string, discount: number) => void
  removeItem: (productId: string) => void
  clearCart: () => void

  // totais
  subtotal: number
  totalDiscount: number
  total: number

  // checkout
  checkout: (method: PaymentMethod, received: number) => Sale | null

  // produtos
  saveProduct: (p: Product) => void
  deleteProduct: (id: string) => void

  // clientes
  saveCustomer: (c: Customer) => void
  deleteCustomer: (id: string) => void

  // caixa
  openCash: (amount: number) => void
  closeCash: () => void
  addCashMovement: (type: 'sangria' | 'suprimento', amount: number, note: string) => void
}

const POSContext = createContext<POSContextValue | null>(null)

export function POSProvider({ children }: { children: ReactNode }) {
  const operator = 'Operador 01'
  const [view, setView] = useState<View>('venda')
  const [products, setProducts] = useState<Product[]>(seedProducts)
  const [customers, setCustomers] = useState<Customer[]>(seedCustomers)
  const [sales, setSales] = useState<Sale[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('c1')
  const [cashSession, setCashSession] = useState<CashSession | null>(null)

  const addToCart = (product: Product, qty = 1) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id)
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, qty: i.qty + qty } : i,
        )
      }
      return [
        ...prev,
        { productId: product.id, name: product.name, price: product.price, qty, discount: 0 },
      ]
    })
  }

  const addByCode = (code: string): Product | null => {
    const raw = code.trim()
    const term = normalize(code)
    if (!term) return null
    const found = products.find(
      (p) =>
        p.barcode === raw ||
        normalize(p.sku) === term ||
        normalize(p.name) === term,
    )
    if (found) {
      addToCart(found)
      return found
    }
    return null
  }

  const updateQty = (productId: string, qty: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.productId === productId ? { ...i, qty: Math.max(0, qty) } : i))
        .filter((i) => i.qty > 0),
    )
  }

  const setItemDiscount = (productId: string, discount: number) => {
    setCart((prev) =>
      prev.map((i) =>
        i.productId === productId ? { ...i, discount: Math.max(0, discount) } : i,
      ),
    )
  }

  const removeItem = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId))
  }

  const clearCart = () => setCart([])

  const subtotal = useMemo(
    () => cart.reduce((sum, i) => sum + i.price * i.qty, 0),
    [cart],
  )
  const totalDiscount = useMemo(
    () => cart.reduce((sum, i) => sum + i.discount, 0),
    [cart],
  )
  const total = Math.max(0, subtotal - totalDiscount)

  const checkout = (method: PaymentMethod, received: number): Sale | null => {
    if (cart.length === 0) return null
    const customer = customers.find((c) => c.id === selectedCustomerId) ?? null
    const sale: Sale = {
      id: uid('V'),
      createdAt: new Date().toISOString(),
      items: cart,
      subtotal,
      discount: totalDiscount,
      total,
      paymentMethod: method,
      received: method === 'dinheiro' ? received : total,
      change: method === 'dinheiro' ? Math.max(0, received - total) : 0,
      customerId: customer?.id ?? null,
      customerName: customer?.name ?? null,
      operator,
    }
    setSales((prev) => [sale, ...prev])

    // baixa de estoque
    setProducts((prev) =>
      prev.map((p) => {
        const item = cart.find((i) => i.productId === p.id)
        return item ? { ...p, stock: p.stock - item.qty } : p
      }),
    )

    // registra entrada no caixa se dinheiro
    if (method === 'dinheiro' && cashSession && cashSession.status === 'aberto') {
      const mov: CashMovement = {
        id: uid('M'),
        type: 'venda',
        amount: total,
        note: `Venda ${sale.id}`,
        createdAt: sale.createdAt,
      }
      setCashSession((prev) =>
        prev ? { ...prev, movements: [mov, ...prev.movements] } : prev,
      )
    }

    clearCart()
    setSelectedCustomerId('c1')
    return sale
  }

  const saveProduct = (p: Product) => {
    setProducts((prev) => {
      const exists = prev.some((x) => x.id === p.id)
      return exists ? prev.map((x) => (x.id === p.id ? p : x)) : [p, ...prev]
    })
  }

  const deleteProduct = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id))
  }

  const saveCustomer = (c: Customer) => {
    setCustomers((prev) => {
      const exists = prev.some((x) => x.id === c.id)
      return exists ? prev.map((x) => (x.id === c.id ? c : x)) : [...prev, c]
    })
  }

  const deleteCustomer = (id: string) => {
    if (id === 'c1') return // não remove Consumidor Final
    setCustomers((prev) => prev.filter((c) => c.id !== id))
  }

  const openCash = (amount: number) => {
    const now = new Date().toISOString()
    setCashSession({
      id: uid('CX'),
      openedAt: now,
      closedAt: null,
      openingAmount: amount,
      status: 'aberto',
      operator,
      movements: [
        { id: uid('M'), type: 'abertura', amount, note: 'Abertura de caixa', createdAt: now },
      ],
    })
  }

  const closeCash = () => {
    setCashSession((prev) =>
      prev
        ? {
            ...prev,
            status: 'fechado',
            closedAt: new Date().toISOString(),
            movements: [
              {
                id: uid('M'),
                type: 'fechamento',
                amount: 0,
                note: 'Fechamento de caixa',
                createdAt: new Date().toISOString(),
              },
              ...prev.movements,
            ],
          }
        : prev,
    )
  }

  const addCashMovement = (type: 'sangria' | 'suprimento', amount: number, note: string) => {
    setCashSession((prev) =>
      prev
        ? {
            ...prev,
            movements: [
              { id: uid('M'), type, amount, note, createdAt: new Date().toISOString() },
              ...prev.movements,
            ],
          }
        : prev,
    )
  }

  const value: POSContextValue = {
    view,
    setView,
    operator,
    products,
    customers,
    sales,
    cashSession,
    cart,
    selectedCustomerId,
    setSelectedCustomerId,
    addToCart,
    addByCode,
    updateQty,
    setItemDiscount,
    removeItem,
    clearCart,
    subtotal,
    totalDiscount,
    total,
    checkout,
    saveProduct,
    deleteProduct,
    saveCustomer,
    deleteCustomer,
    openCash,
    closeCash,
    addCashMovement,
  }

  return <POSContext.Provider value={value}>{children}</POSContext.Provider>
}

export function usePOS() {
  const ctx = useContext(POSContext)
  if (!ctx) throw new Error('usePOS deve ser usado dentro de POSProvider')
  return ctx
}
