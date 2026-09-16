import type { AuthTokens } from '@easypdv/shared-types'
import { useAdminAuthStore } from './admin-auth-store'

/**
 * Painel admin (Fase 2, 2026-09-14) fala DIRETO com o Intermediador — nunca
 * com o pdv-backend local (esse client é o único que aponta pra lá dentro
 * do mesmo bundle estático; as rotas do PDV continuam usando api-client.ts
 * contra 127.0.0.1:4001). Ver "Planejamento - Lembrete de Renovação do
 * Clube.md" no cofre Obsidian, seção do painel (Opção B).
 */
export const INTERMEDIADOR_URL = process.env.NEXT_PUBLIC_INTERMEDIADOR_URL ?? 'http://127.0.0.1:4002'

export class AdminApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code)
    this.name = 'AdminApiError'
  }
}

interface AdminApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  /** /auth/login e /auth/refresh não anexam Bearer nem disparam retry de refresh em 401. */
  skipAuth?: boolean
}

async function rawRequest<T>(path: string, options: AdminApiRequestOptions): Promise<T> {
  const { method = 'GET', body, skipAuth } = options
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  if (!skipAuth) {
    const token = useAdminAuthStore.getState().tokens?.accessToken
    if (token) headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(new URL(path, INTERMEDIADOR_URL), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (response.status === 204) {
    return undefined as T
  }

  const parsed = (await response.json().catch(() => null)) as
    | { message?: string; fieldErrors?: Record<string, string[]>; formErrors?: string[]; error?: string }
    | null

  if (!response.ok) {
    const fieldIssues = parsed?.fieldErrors
      ? Object.entries(parsed.fieldErrors)
          .map(([field, issues]) => `${field}: ${issues.join(', ')}`)
          .join('; ')
      : ''
    const message = parsed?.message ?? fieldIssues ?? parsed?.error ?? response.statusText
    throw new AdminApiError(response.status, message)
  }

  return parsed as T
}

let refreshPromise: Promise<AuthTokens | null> | null = null

async function refreshSession(): Promise<AuthTokens | null> {
  const state = useAdminAuthStore.getState()
  const currentRefreshToken = state.tokens?.refreshToken
  const organizationId = state.user?.organizationId
  if (!currentRefreshToken || !organizationId) {
    // Mesmo raciocínio do api-client.ts (achado M5): sem refreshToken pra
    // renovar não é "segue autenticado sem precisar renovar", é sessão morta.
    useAdminAuthStore.getState().clear()
    return null
  }

  try {
    // organizationId no path só por convenção do controller (OrgAuthController
    // fica sob /organizations/:organizationId/auth inteiro) — o handler de
    // refresh não lê o param, o refreshToken já identifica a sessão sozinho.
    const tokens = await rawRequest<AuthTokens>(`/organizations/${organizationId}/auth/refresh`, {
      method: 'POST',
      body: { refreshToken: currentRefreshToken },
      skipAuth: true,
    })
    const user = useAdminAuthStore.getState().user
    if (user) useAdminAuthStore.getState().setSession(user, tokens)
    return tokens
  } catch {
    useAdminAuthStore.getState().clear()
    return null
  }
}

export async function adminApiRequest<T>(path: string, options: AdminApiRequestOptions = {}): Promise<T> {
  try {
    return await rawRequest<T>(path, options)
  } catch (error) {
    if (error instanceof AdminApiError && error.status === 401 && !options.skipAuth) {
      if (!refreshPromise) {
        refreshPromise = refreshSession().finally(() => {
          refreshPromise = null
        })
      }
      const newTokens = await refreshPromise
      if (newTokens) {
        return rawRequest<T>(path, options)
      }
    }
    throw error
  }
}
