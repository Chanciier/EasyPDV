import { create } from 'zustand'
import type { ReceiptPrintPayload } from '@easypdv/shared-types'

/**
 * Fila de "impressão fiscal pendente" — precisa sobreviver à troca de aba.
 * Antes morava em useState dentro de SaleView, e o polling parava de vez
 * (silenciosamente, sem erro nenhum) assim que o operador saía da tela de
 * Venda antes da NFC-e terminar de emitir (SaleView desmonta, matando o
 * useEffect/useQuery junto) — bug real encontrado em campo (2026-08-25):
 * "a nota fiscal está sendo gerada, porém não está sendo impressa". A NFC-e
 * emitia normal no Bling, só a impressão automática local nunca disparava.
 * Ver components/pos/fiscal-print-watcher.tsx, montado fora do switch de
 * views em pos-shell.tsx (sempre ativo, não só quando view === 'venda').
 */
interface FiscalPrintState {
  pending: { saleId: string; basePayload: Omit<ReceiptPrintPayload, 'fiscal'> } | null
  setPending: (value: FiscalPrintState['pending']) => void
  clear: () => void
}

export const useFiscalPrintStore = create<FiscalPrintState>()((set) => ({
  pending: null,
  setPending: (value) => set({ pending: value }),
  clear: () => set({ pending: null }),
}))
