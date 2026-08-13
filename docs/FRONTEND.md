# Arquitetura do Frontend — EasyPDV

`apps/pdv-frontend` — Next.js reaproveitado do protótipo original (v0.app), sendo migrado de dados mock para a API real.

## Export estático

O app é 100% client-side (zero API routes, zero Server Actions) → `output: 'export'` no `next.config.mjs`. O Electron carrega o HTML/JS/CSS estático direto, sem servidor Next embutido. **Restrição**: toda comunicação com o backend é via `fetch` client-side, nunca rota server-side do Next.

## Separação de estado

- **Estado de servidor** (produtos, vendas, clientes, status de sincronização) → **TanStack Query**, com `staleTime` diferenciado por recurso (catálogo cacheável por minutos; caixa/sync quase em tempo real, invalidado por evento realtime).
- **Estado de UI/rascunho** (carrinho em edição, view ativa, modais) → **Zustand** (`useCartStore`, `useUiStore`, `useAuthStore`).
- O `pos-provider.tsx` original misturava os dois — essa mistura termina na migração.

## Estrutura

```
app/            (auth)/login, (pos)/ — cresce além da rota única original
providers/      QueryProvider, AuthProvider, RealtimeProvider
hooks/          useProducts, useSaleDraft, useCashSession, useSyncStatus...
stores/         useCartStore, useUiStore, useAuthStore (Zustand)
services/       cliente HTTP tipado por recurso (salesApi.ts, productsApi.ts...)
components/     as 5 telas existentes (Venda/Caixa/Produtos/Histórico/Clientes) — mantidas visualmente
```

As telas e atalhos de teclado existentes (F1-F9, navegação keyboard-first) são preservados — a mudança é a origem do dado, não a UI.

Ver [ELECTRON.md](./ELECTRON.md) para como esse build estático é empacotado.
