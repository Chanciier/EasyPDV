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

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | undefined>;
  /** /auth/login e /auth/refresh não anexam Bearer nem disparam retry de refresh em 401. */
  skipAuth?: boolean;
}

function buildUrl(path: string, query?: Record<string, string | undefined>): string {
  const url = new URL(path, API_BASE_URL);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, value);
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

  const parsed = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;

  if (!response.ok) {
    throw new ApiError(response.status, parsed?.message ?? parsed?.error ?? response.statusText);
  }

  return parsed as T;
}

// Dedup: várias requisições caindo em 401 ao mesmo tempo disparam uma única
// troca de refresh_token, não uma por requisição.
let refreshPromise: Promise<AuthTokens | null> | null = null;

async function refreshSession(): Promise<AuthTokens | null> {
  const currentRefreshToken = useAuthStore.getState().tokens?.refreshToken;
  if (!currentRefreshToken) return null;

  try {
    const tokens = await rawRequest<AuthTokens>("/auth/refresh", {
      method: "POST",
      body: { refreshToken: currentRefreshToken },
      skipAuth: true,
    });
    const user = useAuthStore.getState().user;
    if (user) useAuthStore.getState().setSession(user, tokens);
    return tokens;
  } catch {
    useAuthStore.getState().clear();
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
