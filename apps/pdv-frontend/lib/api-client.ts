import type { AuthTokens } from "@easypdv/shared-types";
import { useAuthStore } from "./auth-store";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4001";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
    this.name = "ApiError";
  }
}

/**
 * Extrai uma mensagem de erro amigável — antes copiada (com pelo menos uma
 * variante mais fraca, que não checava `ApiError` e só funcionava por
 * `ApiError.message` coincidir com `.code`) em 11+ componentes.
 */
export function describeError(error: unknown, fallback = "Erro inesperado"): string {
  if (error instanceof ApiError) return error.code;
  if (error instanceof Error) return error.message;
  return fallback;
}

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
  /** /auth/login e /auth/refresh não anexam Bearer nem disparam retry de refresh em 401. */
  skipAuth?: boolean;
}

interface ErrorResponseBody {
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  formErrors?: string[];
}

/**
 * `ZodValidationPipe` (pdv-backend) lança `BadRequestException(result.error.flatten())`
 * — o corpo vira `{fieldErrors, formErrors}`, sem `message`/`error` nenhum.
 * Sem tratar esse formato, qualquer validação (ex: CPF inválido ao anexar
 * cliente numa venda) aparecia pro operador como um "Bad Request" genérico
 * (`response.statusText`) em vez do motivo real — mesma classe de bug já
 * corrigida do lado do Intermediador em `describe-http-error.ts`.
 */
function extractErrorCode(body: ErrorResponseBody | string | null, fallback: string): string {
  if (typeof body === "string") return body || fallback;
  if (body?.message) return body.message;
  const fieldIssues = body?.fieldErrors
    ? Object.entries(body.fieldErrors)
        .map(([field, issues]) => `${field}: ${issues.join(", ")}`)
        .join("; ")
    : "";
  if (fieldIssues || body?.formErrors?.length) {
    return [fieldIssues, ...(body?.formErrors ?? [])].filter(Boolean).join("; ");
  }
  return body?.error ?? fallback;
}

function buildUrl(path: string, query?: Record<string, string | string[] | undefined>): string {
  const url = new URL(path, API_BASE_URL);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        for (const v of value) url.searchParams.append(key, v);
      } else {
        url.searchParams.set(key, value);
      }
    }
  }
  return url.toString();
}

async function rawRequest<T>(path: string, options: ApiRequestOptions): Promise<T> {
  const { method = "GET", body, query, skipAuth } = options;
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (!skipAuth) {
    const token = useAuthStore.getState().tokens?.accessToken;
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const parsed = (await response.json().catch(() => null)) as ErrorResponseBody | string | null;

  if (!response.ok) {
    throw new ApiError(response.status, extractErrorCode(parsed, response.statusText));
  }

  return parsed as T;
}

// Dedup: várias requisições caindo em 401 ao mesmo tempo disparam uma única
// troca de refresh_token, não uma por requisição.
let refreshPromise: Promise<AuthTokens | null> | null = null;

async function refreshSession(): Promise<AuthTokens | null> {
  const currentRefreshToken = useAuthStore.getState().tokens?.refreshToken;
  if (!currentRefreshToken) {
    // Reload depois do achado M5 (refreshToken não persiste mais em disco):
    // accessToken expirado + refreshToken vazio não é "sem sessão para
    // renovar", é sessão morta - sem isso o app fica com isAuthenticated
    // true (persistido) mas todo request 401 pra sempre, sem cair pro login.
    useAuthStore.getState().clear();
    return null;
  }

  try {
    const tokens = await rawRequest<AuthTokens>("/auth/refresh", {
      method: "POST",
      body: { refreshToken: currentRefreshToken },
      skipAuth: true,
    });
    const user = useAuthStore.getState().user;
    if (user) useAuthStore.getState().setSession(user, tokens);
    return tokens;
  } catch (error) {
    // Achado real (2026-09-17): logout "aleatório" durante o uso, sem
    // reinício do app — este catch tratava QUALQUER falha aqui (rede
    // instável, SQLite local ocupado por um instante, timeout) como
    // "refresh token inválido", derrubando a sessão por um problema
    // transitório. Só um 401 de verdade do próprio /auth/refresh prova que
    // o token não vale mais (expirado/revogado/já rotacionado) — qualquer
    // outro erro só falha ESSA tentativa (o chamador já vê o erro original
    // propagar), sem mexer na sessão; a próxima chamada tenta de novo com o
    // mesmo refreshToken (ainda válido em memória), sem nunca ter deslogado.
    if (error instanceof ApiError && error.status === 401) {
      useAuthStore.getState().clear();
    }
    return null;
  }
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  try {
    return await rawRequest<T>(path, options);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401 && !options.skipAuth) {
      if (!refreshPromise) {
        refreshPromise = refreshSession().finally(() => {
          refreshPromise = null;
        });
      }
      const newTokens = await refreshPromise;
      if (newTokens) {
        return rawRequest<T>(path, options);
      }
    }
    throw error;
  }
}
