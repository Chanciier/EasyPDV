'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

type View =
  | 'venda'
  | 'caixa'
  | 'produtos'
  | 'historico'
  | 'clientes'
  | 'clube'
  | 'vale-troca'
  | 'auditoria'
  | 'relatorios'
  | 'administracao'

type POSContextValue = {
  view: View
  setView: (v: View) => void
}

const POSContext = createContext<POSContextValue | null>(null)

export function POSProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>('venda')

  return (
    <POSContext.Provider value={{ view, setView }}>{children}</POSContext.Provider>
  )
}

export function usePOS() {
  const ctx = useContext(POSContext)
  if (!ctx) throw new Error('usePOS deve ser usado dentro de POSProvider')
  return ctx
}
