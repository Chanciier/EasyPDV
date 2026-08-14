import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthTokens, User } from "@easypdv/shared-types";

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  setSession: (user: User, tokens: AuthTokens) => void;
  clear: () => void;
}

/**
 * Sem middleware de rota (export estático / Electron não roda servidor) —
 * a guarda é 100% client-side em app/page.tsx, lendo `isAuthenticated` daqui.
 * Persistido em localStorage pra sobreviver a reload; api-client.ts lê/escreve
 * aqui via useAuthStore.getState() fora de componentes React.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tokens: null,
      isAuthenticated: false,
      setSession: (user, tokens) => set({ user, tokens, isAuthenticated: true }),
      clear: () => set({ user: null, tokens: null, isAuthenticated: false }),
    }),
    { name: "easypdv-auth" },
  ),
);
