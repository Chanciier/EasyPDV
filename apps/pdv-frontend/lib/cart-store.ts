import { create } from 'zustand'

/**
 * Decisão de desconto do Clube Saldão para um produto da venda (regra de
 * ux-revisao §2, 2026-10-22). `percent: 0` = operador tirou o desconto de
 * propósito — conta como decisão e nunca volta pros 30% (regra de
 * 2026-09-17). `fixed` = desconto digitado em R$ no editor do item (não
 * acompanha a quantidade).
 */
export type ClubDecision = { kind: 'percent'; percent: number } | { kind: 'fixed' }

/** Sobrevive a Ctrl+R (recarregar) e some ao fechar o app — ver `setSaleId`. */
const SALE_ID_STORAGE_KEY = 'easypdv:cart:saleId'

function writeStoredSaleId(id: string | null) {
  try {
    if (typeof window === 'undefined') return
    if (id) window.sessionStorage.setItem(SALE_ID_STORAGE_KEY, id)
    else window.sessionStorage.removeItem(SALE_ID_STORAGE_KEY)
  } catch {
    // sessionStorage indisponível: só perde a retomada depois de recarregar.
  }
}

/** Lido pela tela de Venda ao montar (UX-18) — quem valida se o rascunho ainda existe é ela. */
export function readStoredSaleId(): string | null {
  try {
    if (typeof window === 'undefined') return null
    return window.sessionStorage.getItem(SALE_ID_STORAGE_KEY)
  } catch {
    return null
  }
}

/**
 * Estado transitório da tela de Venda: qual rascunho está em andamento, qual
 * linha está selecionada e o que só existe na tela (decisões de desconto do
 * Clube, "recebido" em dinheiro pra calcular troco). O conteúdo real da venda
 * (itens, pagamentos, total) mora no cache do TanStack Query (ver
 * hooks/use-sales.ts). Fica num store (e não em useState do SaleView) porque
 * o SaleView desmonta ao trocar de aba — antes, voltar pra Venda e apertar F4
 * reaplicava 30% em itens já decididos e o recibo perdia o troco (UX-04).
 */
interface CartState {
  saleId: string | null
  /** productId da linha selecionada (não o id do SaleItem). */
  selectedProductId: string | null
  /** Por productId (não itemId): sobrevive a remover e bipar de novo só enquanto a linha existir — ver `forgetClubDecision`. */
  clubDecisions: Record<string, ClubDecision>
  /** "Recebido" em dinheiro por pagamento — nunca persistido no backend (Payment guarda só o valor aplicado). */
  receivedByPaymentId: Record<string, number>
  /** Trocar de venda zera decisões e recebidos (nunca vazam de uma venda pra outra). */
  setSaleId: (id: string | null) => void
  setSelectedProductId: (id: string | null) => void
  setClubDecision: (productId: string, decision: ClubDecision) => void
  setClubDecisions: (decisions: Record<string, ClubDecision>) => void
  forgetClubDecision: (productId: string) => void
  setReceived: (paymentId: string, received: number) => void
  reset: () => void
}

export const useCartStore = create<CartState>()((set, get) => ({
  saleId: null,
  selectedProductId: null,
  clubDecisions: {},
  receivedByPaymentId: {},
  setSaleId: (id) => {
    writeStoredSaleId(id)
    if (get().saleId === id) return
    set({ saleId: id, clubDecisions: {}, receivedByPaymentId: {} })
  },
  setSelectedProductId: (id) => set({ selectedProductId: id }),
  setClubDecision: (productId, decision) =>
    set((s) => ({ clubDecisions: { ...s.clubDecisions, [productId]: decision } })),
  setClubDecisions: (decisions) => set((s) => ({ clubDecisions: { ...s.clubDecisions, ...decisions } })),
  forgetClubDecision: (productId) =>
    set((s) => {
      if (!(productId in s.clubDecisions)) return s
      const next = { ...s.clubDecisions }
      delete next[productId]
      return { clubDecisions: next }
    }),
  setReceived: (paymentId, received) =>
    set((s) => ({ receivedByPaymentId: { ...s.receivedByPaymentId, [paymentId]: received } })),
  reset: () => {
    writeStoredSaleId(null)
    set({ saleId: null, selectedProductId: null, clubDecisions: {}, receivedByPaymentId: {} })
  },
}))
