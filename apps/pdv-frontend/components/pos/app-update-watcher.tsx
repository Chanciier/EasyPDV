'use client'

import { useEffect } from 'react'
import { useAppUpdateStore } from '@/lib/app-update-store'

/**
 * Sem UI própria — só assina o evento onUpdateDownloaded (Main -> Renderer,
 * ver preload/index.ts) e grava no store global. Fica montado fora do switch
 * de views (pos-shell.tsx), mesmo padrão do FiscalPrintWatcher: precisa
 * continuar escutando mesmo se o operador estiver noutra aba quando a
 * atualização terminar de baixar. `window.easypdv` só existe dentro do
 * Electron empacotado — undefined em `next dev` puro, sem efeito nenhum.
 */
export function AppUpdateWatcher() {
  const setDownloaded = useAppUpdateStore((s) => s.setDownloaded)

  useEffect(() => {
    const bridge = typeof window !== 'undefined' ? window.easypdv : undefined
    if (!bridge) return
    return bridge.onUpdateDownloaded(setDownloaded)
  }, [setDownloaded])

  return null
}
