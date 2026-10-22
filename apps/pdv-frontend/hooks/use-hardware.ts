import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { HardwareSettings, ReceiptPrintPayload } from '@easypdv/shared-types'

/**
 * window.easypdv só existe dentro do Electron — em `next dev` puro (navegador
 * comum, ver docs/FRONTEND.md) fica undefined. Todo hook aqui trata isso como
 * "recurso indisponível", nunca como erro — hardware é opcional, a venda
 * funciona sem impressora configurada.
 */
function getBridge() {
  if (typeof window === 'undefined') return null
  return window.easypdv ?? null
}

export function isElectron(): boolean {
  return getBridge() !== null
}

/**
 * Erro de `ipcRenderer.invoke` chega como "Error invoking remote method
 * 'canal': Error: <mensagem>" — tira o prefixo técnico para o operador ver
 * só a mensagem em português escrita no Main (ex.: validação do SEG-04).
 */
export function cleanIpcError(error: unknown): Error {
  const raw = error instanceof Error ? error.message : String(error)
  return new Error(raw.replace(/^Error invoking remote method '[^']+':\s*(?:\w*Error:\s*)?/, ''))
}

async function withCleanIpcError<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call()
  } catch (error) {
    throw cleanIpcError(error)
  }
}

export function useHardwareSettings() {
  return useQuery({
    queryKey: ['hardware', 'settings'],
    queryFn: () => getBridge()!.getSettings(),
    enabled: isElectron(),
  })
}

export function useUpdateHardwareSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (partial: Partial<HardwareSettings>) => withCleanIpcError(() => getBridge()!.setSettings(partial)),
    onSuccess: (settings) => queryClient.setQueryData(['hardware', 'settings'], settings),
  })
}

export function usePrinterList() {
  return useQuery({
    queryKey: ['hardware', 'printers'],
    queryFn: () => getBridge()!.listPrinters(),
    enabled: isElectron(),
  })
}

/** No-op silencioso fora do Electron — impressão é sempre opcional, nunca bloqueia a venda. */
export function usePrintReceipt() {
  return useMutation({
    mutationFn: async (payload: ReceiptPrintPayload) => {
      const bridge = getBridge()
      if (!bridge) return
      await withCleanIpcError(() => bridge.printReceipt(payload))
    },
  })
}

export function useOpenDrawer() {
  return useMutation({
    mutationFn: async () => {
      const bridge = getBridge()
      if (!bridge) return
      await bridge.openDrawer()
    },
  })
}
