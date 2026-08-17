// Camada de dados do PDV.
// Os dados abaixo são MOCK apenas para o frontend.
// Troque as funções por chamadas ao seu backend quando integrar.

export type Product = {
  id: string
  sku: string
  barcode: string
  name: string
  price: number
  stock: number
  category: string
}

export type CartItem = {
  productId: string
  name: string
  price: number
  qty: number
  discount: number // desconto em R$ por item (total da linha)
}

export type PaymentMethod = 'dinheiro' | 'cartao_credito' | 'cartao_debito' | 'pix'

export type Sale = {
  id: string
  createdAt: string // ISO
  items: CartItem[]
  subtotal: number
  discount: number
  total: number
  paymentMethod: PaymentMethod
  received: number
  change: number
  customerId: string | null
  customerName: string | null
  operator: string
}

export type CashMovementType = 'abertura' | 'sangria' | 'suprimento' | 'venda' | 'fechamento'

export type CashMovement = {
  id: string
  type: CashMovementType
  amount: number
  note: string
  createdAt: string
}

export type CashSession = {
  id: string
  openedAt: string
  closedAt: string | null
  openingAmount: number
  movements: CashMovement[]
  status: 'aberto' | 'fechado'
  operator: string
}

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  dinheiro: 'Dinheiro',
  cartao_credito: 'Cartão de Crédito',
  cartao_debito: 'Cartão de Débito',
  pix: 'PIX',
}

export const formatBRL = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function uid(prefix = '') {
  return prefix + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4)
}

// Normaliza texto para busca: minúsculo e sem acentos.
export function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export const seedProducts: Product[] = [
  { id: 'p1', sku: '7890001', barcode: '7891000100011', name: 'Café Torrado 500g', price: 18.9, stock: 42, category: 'Mercearia' },
  { id: 'p2', sku: '7890002', barcode: '7891000100028', name: 'Leite Integral 1L', price: 5.49, stock: 120, category: 'Laticínios' },
  { id: 'p3', sku: '7890003', barcode: '7891000100035', name: 'Pão de Forma', price: 8.75, stock: 30, category: 'Padaria' },
  { id: 'p4', sku: '7890004', barcode: '7891000100042', name: 'Refrigerante Cola 2L', price: 9.99, stock: 64, category: 'Bebidas' },
  { id: 'p5', sku: '7890005', barcode: '7891000100059', name: 'Arroz Branco 5kg', price: 27.9, stock: 25, category: 'Mercearia' },
  { id: 'p6', sku: '7890006', barcode: '7891000100066', name: 'Feijão Carioca 1kg', price: 8.49, stock: 55, category: 'Mercearia' },
  { id: 'p7', sku: '7890007', barcode: '7891000100073', name: 'Sabão em Pó 1kg', price: 14.3, stock: 38, category: 'Limpeza' },
  { id: 'p8', sku: '7890008', barcode: '7891000100080', name: 'Detergente 500ml', price: 2.99, stock: 90, category: 'Limpeza' },
  { id: 'p9', sku: '7890009', barcode: '7891000100097', name: 'Água Mineral 1,5L', price: 3.2, stock: 200, category: 'Bebidas' },
  { id: 'p10', sku: '7890010', barcode: '7891000100103', name: 'Chocolate ao Leite 90g', price: 6.49, stock: 75, category: 'Doces' },
  { id: 'p11', sku: '7890011', barcode: '7891000100110', name: 'Biscoito Recheado', price: 4.19, stock: 110, category: 'Doces' },
  { id: 'p12', sku: '7890012', barcode: '7891000100127', name: 'Óleo de Soja 900ml', price: 7.89, stock: 48, category: 'Mercearia' },
]
