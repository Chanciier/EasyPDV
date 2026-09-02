import { create } from 'zustand'

/**
 * Estado da atualização disponível (2026-09-03) — precisa sobreviver à troca
 * de aba, mesmo motivo do fiscal-print-store.ts: o clique em "Atualizar
 * agora" (pos-shell.tsx) pode acontecer com o caixa aberto, mas o fechamento
 * de fato só acontece na tela Caixa (cash-view.tsx) — `applyRequested`
 * "lembra" que era pra aplicar a atualização assim que aquele fechamento
 * terminar, sem acoplar as duas telas diretamente uma na outra.
 */
interface AppUpdateState {
  downloaded: boolean
  applyRequested: boolean
  setDownloaded: () => void
  requestApply: () => void
  clearApplyRequested: () => void
}

export const useAppUpdateStore = create<AppUpdateState>()((set) => ({
  downloaded: false,
  applyRequested: false,
  setDownloaded: () => set({ downloaded: true }),
  requestApply: () => set({ applyRequested: true }),
  clearApplyRequested: () => set({ applyRequested: false }),
}))
