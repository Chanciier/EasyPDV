import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthTokens, OrgUserPayload } from '@easypdv/shared-types'

interface AdminAuthState {
  user: OrgUserPayload | null
  tokens: AuthTokens | null
  isAuthenticated: boolean
  setSession: (user: OrgUserPayload, tokens: AuthTokens) => void
  clear: () => void
}

/**
 * Sessão do painel admin (Fase 2, 2026-09-14) — separada de useAuthStore
 * (operador de caixa, sessão contra o pdv-backend LOCAL). Este painel fala
 * DIRETO com o Intermediador, de um navegador comum, potencialmente numa
 * origem diferente do PDV — mesma ideia (persist em localStorage, chave
 * própria pra não colidir), sessão de admin nunca vaza pro app do operador.
 */
export const useAdminAuthStore = create<AdminAuthState>()(
  persist(
    (set) => ({
      user: null,
      tokens: null,
      isAuthenticated: false,
      setSession: (user, tokens) => set({ user, tokens, isAuthenticated: true }),
      clear: () => set({ user: null, tokens: null, isAuthenticated: false }),
    }),
    {
      name: 'easypdv-admin-auth',
      // Achado M5 da auditoria de segurança (2026-09-14): refreshToken (30
      // dias de validade) deixa de ir pro localStorage — só o accessToken
      // (15min) e o resto da sessão persistem. Reduz a janela de roubo de
      // token (XSS futuro) de 30 dias pra 15min: o refreshToken continua
      // funcionando normalmente durante a mesma sessão de navegador (o
      // estado em memória do zustand tem o valor real, só o que É GRAVADO em
      // disco é que fica sem ele), mas some ao recarregar a página/reabrir o
      // app — depois que o accessToken expirar, força login de novo em vez
      // de renovar silenciosamente pra sempre.
      partialize: (state) => ({
        ...state,
        tokens: state.tokens ? { ...state.tokens, refreshToken: '' } : null,
      }),
    },
  ),
)
