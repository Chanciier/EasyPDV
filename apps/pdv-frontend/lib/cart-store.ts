import { create } from 'zustand'

/**
 * Estado transitório da tela de Venda: qual rascunho de venda está em
 * andamento e qual linha está selecionada. O conteúdo real da venda (itens,
 * pagamentos, total) mora no cache do TanStack Query (ver hooks/use-sales.ts)
 * — este store não guarda nada que também exista no servidor.
 */
interface CartState {
  saleId: string | null
  /** productId da linha selecionada (não o id do SaleItem — esse muda a cada troca de quantidade). */
  selectedProductId: string | null
  setSaleId: (id: string | null) => void
  setSelectedProductId: (id: string | null) => void
  reset: () => void
}

export const useCartStore = create<CartState>()((set) => ({
  saleId: null,
  selectedProductId: null,
  setSaleId: (id) => set({ saleId: id }),
  setSelectedProductId: (id) => set({ selectedProductId: id }),
  reset: () => set({ saleId: null, selectedProductId: null }),
}))
