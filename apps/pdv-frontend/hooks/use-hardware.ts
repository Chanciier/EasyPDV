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
    mutationFn: (partial: Partial<HardwareSettings>) => getBridge()!.setSettings(partial),
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
      await bridge.printReceipt(payload)
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
