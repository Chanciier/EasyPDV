import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { io } from 'socket.io-client'
import { API_BASE_URL } from '@/lib/api-client'

/**
 * Não autenticado por design, mesma fronteira de confiança do resto da API
 * local (ver docs/ELECTRON.md "Segurança") — o payload não carrega nada que
 * o cliente não já veria via REST autenticado, é só "algo mudou, revalida".
 * Nenhuma tela depende disso pra funcionar: quem fez a mutação já teve seu
 * próprio cache atualizado por onSuccess (ver use-sales.ts/use-cash.ts) —
 * isso é só pra OUTRAS abas/sessões conectadas ao mesmo pdv-backend
 * (ex: um painel de acompanhamento numa segunda tela) verem em tempo real.
 */
export function useRealtime() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const socket = io(API_BASE_URL, { transports: ['websocket'] })

    socket.on('sale.confirmed', () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      queryClient.invalidateQueries({ queryKey: ['cash-session'] })
      queryClient.invalidateQueries({ queryKey: ['reports', 'dashboard'] })
    })

    socket.on('cash_session.opened', () => {
      queryClient.invalidateQueries({ queryKey: ['cash-session'] })
    })

    socket.on('cash_session.closed', () => {
      queryClient.invalidateQueries({ queryKey: ['cash-session'] })
    })

    return () => {
      socket.disconnect()
    }
  }, [queryClient])
}
