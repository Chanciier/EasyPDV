# Arquitetura do Frontend — EasyPDV

`apps/pdv-frontend` — Next.js reaproveitado do protótipo original (v0.app). A partir da Sprint 9, as telas Venda/Caixa/Produtos/Histórico consomem a API real do `pdv-backend`; Clientes migrou do mock pra API real na Sprint 15 (ver abaixo) — não sobra mais nenhuma tela mockada.

## Export estático

O app é 100% client-side (zero API routes, zero Server Actions) → `output: 'export'` no `next.config.mjs`. O Electron carrega o HTML/JS/CSS estático direto, sem servidor Next embutido. **Restrição**: toda comunicação com o backend é via `fetch` client-side, nunca rota server-side do Next. `next dev` continua funcionando normalmente como servidor de dev local.

## Separação de estado

- **Estado de servidor** (produtos, vendas, caixa) → **TanStack Query**. Cada tela busca/invalida pelo recurso que muda: confirmar uma venda invalida tanto a própria venda quanto `['cash-session']` (uma venda em dinheiro muda o saldo esperado do caixa).
- **Estado de UI/rascunho** → **Zustand**: `useAuthStore` (`lib/auth-store.ts`, persistido em localStorage) e `useCartStore` (`lib/cart-store.ts`, efêmero — guarda só o `saleId` do rascunho atual e a linha selecionada, nunca dado que já existe no cache do TanStack Query).
- `pos-provider.tsx` (Context API simples, não Zustand) — depois da migração de Clientes (Sprint 15) sobrou só `view`/`setView` da navegação, todo o resto do protótipo mock (produtos/carrinho/checkout/clientes) já era código morto confirmado por grep antes desta sprint e continua morto, fora de escopo remover o que não foi diretamente obsoletado por esta mudança. Encolhe a cada sprint até sumir de vez.

## Estrutura real

```
lib/
  api-client.ts     apiRequest<T>() — fetch tipado, Bearer token, dedup de refresh em 401
  auth-store.ts     useAuthStore (Zustand + persist)
  cart-store.ts     useCartStore (Zustand, efêmero)
  pos-data.ts       resto do mock não relacionado a Clientes (código morto pré-existente, fora de escopo)
hooks/
  use-sales.ts      busca de produto (autocomplete), ciclo de vida da venda, listagem p/ Histórico,
                     status fiscal por venda (useFiscalStatus — Sprint 12)
  use-cash.ts       sessão/movimentos de caixa
  use-catalog.ts    CRUD de produto/categoria/tabela de preço (tela Produtos)
  use-customers.ts  CRUD + busca de cliente (tela Clientes, seletor em sale-view) — Sprint 15
  use-hardware.ts   bridge window.easypdv (impressora/gaveta/settings) — Sprint 11, ver ELECTRON.md
  use-backup.ts     bridge window.easypdv (backup local) — Sprint 15, ver ELECTRON.md
  use-sync.ts       GET /sync/status, refetchInterval 15s — Sprint 15 (Modo contingência)
  use-audit.ts      GET /audit-logs — Sprint 13
  use-reports.ts    GET /reports/dashboard (Sprint 13) + /sales, /cash-sessions, /stock (Sprint 15)
  use-realtime.ts   conecta o socket.io-client, invalida queries nos eventos — Sprint 13
components/pos/
  sale-view.tsx, cash-view.tsx, products-view.tsx, history-view.tsx   migradas (Sprint 9)
  customers-view.tsx                                                  API real (Sprint 15)
  reports-view.tsx                                                    vendas/caixas/estoque (Sprint 15,
                                                                       nav só visível pra administrador/
                                                                       gerente/proprietario)
  payment-dialog.tsx, receipt-dialog.tsx                               migradas junto com sale-view
  settings-dialog.tsx                                                 config de hardware (Sprint 11) +
                                                                       backup local (Sprint 15)
  audit-view.tsx                                                     trilha de auditoria (Sprint 13,
                                                                       nav só visível pra administrador/
                                                                       gerente/auditor)
  ui/stat-card.tsx                                                   card de estatística reutilizável
                                                                       (promovido do Histórico, Sprint 15)
```

Não existem `services/`, `stores/` (plural) nem rotas `app/(auth)/` — isso era o desenho inicial da Sprint 0; na prática a migração coube em `lib/` + `hooks/` sem precisar dessas camadas extras.

As telas e atalhos de teclado existentes (F1-F9, navegação keyboard-first) foram preservados — a mudança é a origem do dado, não a UI.

**Leitor de código de barras (Sprint 11)**: captura global de keydown em `sale-view.tsx`, só ativa na tela Venda. Sem input/select/textarea focado e sem diálogo de pagamento/recibo aberto, o primeiro caractere digitado foca a busca e é encaminhado manualmente (com `e.preventDefault()` — sem isso o caractere duplica, porque o navegador aplica a inserção nativa de texto no elemento recém-focado pelo próprio handler); o resto do código + Enter segue o fluxo normal do input, caindo no fallback `GET /products/by-barcode/:code` já existente desde a Sprint 9. Toda a lógica de hardware (impressora/gaveta) só funciona dentro do Electron — `hooks/use-hardware.ts` trata `window.easypdv` ausente como recurso indisponível, nunca como erro (ver [ELECTRON.md](./ELECTRON.md)).

**Realtime (Sprint 13, `sale.voided` adicionado na Sprint 14)**: `useRealtime()` conecta uma vez em `pos-shell.tsx` (`socket.io-client`, mesma porta do `pdv-backend`) e invalida as queries do TanStack Query (`sales`, `cash-session`, `reports.dashboard`) quando chega `sale.confirmed`/`sale.voided`/`cash_session.opened`/`cash_session.closed` de qualquer origem — inclusive da própria aba, mas isso não causa problema (invalidar uma query já atualizada só refaz o fetch e recebe o mesmo dado). Testado de verdade com duas abas reais do navegador: venda confirmada numa aba atualizou o resumo do dia e a lista de vendas da outra sem refresh manual. Nav "Auditoria" (`audit-view.tsx`) só aparece pra `administrador`/`gerente`/`auditor` (`AUDIT_ROLES` em `pos-shell.tsx`) — primeiro branch por `user.role` no frontend, backend já reforça isso de qualquer forma via `@Roles` no `AuditController`. Nav "Relatórios" (`reports-view.tsx`, Sprint 15) segue o mesmo padrão pra `administrador`/`gerente`/`proprietario` (`REPORTS_ROLES`).

**Modo contingência (Sprint 15)**: `useSyncStatus()` (polling a cada 15s, não realtime — o `SyncOutboxWorker` do backend também roda por polling) alimenta um badge discreto no header de `pos-shell.tsx`, visível pra **qualquer** operador (o endpoint `GET /sync/status` não tem `@Roles` de propósito — ao contrário do detalhe em `GET /sync/outbox`, que continua restrito). Nada aparece com tudo sincronizado; pill destrutivo "Falha de sincronização (N)" ou neutro "Sincronização pendente (N)" caso contrário. É só visibilidade sobre um mecanismo que já existia desde a Sprint 6 (outbox + retry) — nenhum comportamento de sincronização mudou.

## Padrão de mutação: saleId no `mutate()`, não no hook

Os hooks de ciclo de vida da venda (`useAddSaleItem`, `useRemoveSaleItem`, `useRegisterPayment`, `useConfirmSale` em `hooks/use-sales.ts`) recebem `saleId` como parte do input de cada chamada, em vez de fechado no hook via parâmetro. Motivo: no primeiro item de uma venda, o `saleId` nasce "lazy" (`POST /sales`) dentro do mesmo handler que já chama `addItem` em seguida — se o hook capturasse `saleId` do estado do componente no momento do render, a segunda chamada ainda veria `null` (stale closure), já que o `setSaleId` do Zustand só reflete no próximo render. Recebendo o id no próprio `mutate()` e atualizando o cache pela resposta (que sempre traz `sale.id`), esse problema não existe.

## Sem endpoint de "trocar quantidade"

`POST /sales/:id/items` sempre cria uma linha nova — não existe um `PATCH` para alterar a quantidade de um item já existente. `sale-view.tsx` contorna isso fazendo `DELETE` do item seguido de `POST` com a nova quantidade (`changeQty()`), o que causa um flash visual breve (item some e reaparece) a cada `+`/`-`. Funcional e correto, mas é uma lacuna real da API — um `PATCH /sales/:id/items/:itemId` resolveria de forma mais limpa numa sprint futura.

## Escopo cortado

- **Desconto por item**: o mock tinha um campo de desconto por linha do carrinho; a API real não tinha endpoint nenhum para desconto até a Sprint 14, que adicionou desconto fixo (R$) no TOTAL da venda (`PATCH /sales/:id/discount`, sem alçada) — desconto por item continua fora de escopo (não pedido), `SaleItem.discountAmount` segue inerte.
- **Perfil de cliente**: o seletor de cliente em `sale-view.tsx` (Sprint 15) é busca + seleção simples, não uma tela de perfil/histórico de compras do cliente — escopo mínimo deliberado, não pedido.
- **Estoque na tela Produtos**: o mock tinha um campo "estoque" editável direto no produto. No sistema real, estoque é do módulo Inventory (`StockItem` por depósito, via `POST /stock/movements`), não um campo do Product — fora do escopo desta migração de Catálogo. A tela Produtos não mostra nem edita estoque.
- **Produtos inativos**: `GET /products/search` só retorna produtos `active:true`. Depois de desativar um produto pela tela (o único "excluir" que existe), ele some da lista e não há como reativá-lo pela UI hoje (não existe endpoint pra listar inativos).

Ver [ELECTRON.md](./ELECTRON.md) para como esse build estático é empacotado.
