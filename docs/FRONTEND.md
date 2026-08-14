# Arquitetura do Frontend — EasyPDV

`apps/pdv-frontend` — Next.js reaproveitado do protótipo original (v0.app). A partir da Sprint 9, as telas Venda/Caixa/Produtos/Histórico consomem a API real do `pdv-backend`; só Clientes segue mockada (ver "Escopo cortado" abaixo).

## Export estático

O app é 100% client-side (zero API routes, zero Server Actions) → `output: 'export'` no `next.config.mjs`. O Electron carrega o HTML/JS/CSS estático direto, sem servidor Next embutido. **Restrição**: toda comunicação com o backend é via `fetch` client-side, nunca rota server-side do Next. `next dev` continua funcionando normalmente como servidor de dev local.

## Separação de estado

- **Estado de servidor** (produtos, vendas, caixa) → **TanStack Query**. Cada tela busca/invalida pelo recurso que muda: confirmar uma venda invalida tanto a própria venda quanto `['cash-session']` (uma venda em dinheiro muda o saldo esperado do caixa).
- **Estado de UI/rascunho** → **Zustand**: `useAuthStore` (`lib/auth-store.ts`, persistido em localStorage) e `useCartStore` (`lib/cart-store.ts`, efêmero — guarda só o `saleId` do rascunho atual e a linha selecionada, nunca dado que já existe no cache do TanStack Query).
- `pos-provider.tsx` (Context API simples, não Zustand) ainda existe só para as telas não migradas (Clientes) e para `view`/`setView` da navegação — encolhe a cada sprint até sumir.

## Estrutura real

```
lib/
  api-client.ts     apiRequest<T>() — fetch tipado, Bearer token, dedup de refresh em 401
  auth-store.ts     useAuthStore (Zustand + persist)
  cart-store.ts     useCartStore (Zustand, efêmero)
  pos-data.ts       tipos/seed do mock — ainda usado por Clientes e pelo Context legado
hooks/
  use-sales.ts      busca de produto (autocomplete), ciclo de vida da venda, listagem p/ Histórico
  use-cash.ts       sessão/movimentos de caixa
  use-catalog.ts    CRUD de produto/categoria/tabela de preço (tela Produtos)
components/pos/
  sale-view.tsx, cash-view.tsx, products-view.tsx, history-view.tsx   migradas (Sprint 9)
  customers-view.tsx                                                  ainda mock (pos-provider.tsx)
  payment-dialog.tsx, receipt-dialog.tsx                               migradas junto com sale-view
```

Não existem `services/`, `stores/` (plural) nem rotas `app/(auth)/` — isso era o desenho inicial da Sprint 0; na prática a migração coube em `lib/` + `hooks/` sem precisar dessas camadas extras.

As telas e atalhos de teclado existentes (F1-F9, navegação keyboard-first) foram preservados — a mudança é a origem do dado, não a UI.

## Padrão de mutação: saleId no `mutate()`, não no hook

Os hooks de ciclo de vida da venda (`useAddSaleItem`, `useRemoveSaleItem`, `useRegisterPayment`, `useConfirmSale` em `hooks/use-sales.ts`) recebem `saleId` como parte do input de cada chamada, em vez de fechado no hook via parâmetro. Motivo: no primeiro item de uma venda, o `saleId` nasce "lazy" (`POST /sales`) dentro do mesmo handler que já chama `addItem` em seguida — se o hook capturasse `saleId` do estado do componente no momento do render, a segunda chamada ainda veria `null` (stale closure), já que o `setSaleId` do Zustand só reflete no próximo render. Recebendo o id no próprio `mutate()` e atualizando o cache pela resposta (que sempre traz `sale.id`), esse problema não existe.

## Sem endpoint de "trocar quantidade"

`POST /sales/:id/items` sempre cria uma linha nova — não existe um `PATCH` para alterar a quantidade de um item já existente. `sale-view.tsx` contorna isso fazendo `DELETE` do item seguido de `POST` com a nova quantidade (`changeQty()`), o que causa um flash visual breve (item some e reaparece) a cada `+`/`-`. Funcional e correto, mas é uma lacuna real da API — um `PATCH /sales/:id/items/:itemId` resolveria de forma mais limpa numa sprint futura.

## Escopo cortado nesta sprint

- **Cliente da venda**: não existe módulo de Clientes no backend (`Sale.customerId` é uma FK solta, sem endpoint pra listar/criar cliente). O seletor de cliente que existia no mock foi removido da tela de Venda; toda venda nova nasce com `customerId: null` ("Consumidor Final"). A tela Clientes continua 100% mock.
- **Desconto por item**: o mock tinha um campo de desconto por linha do carrinho; a API real não tem endpoint nenhum para desconto (nem em `SaleItem`, nem em `Sale`) — `discountAmount` existe no schema mas nada no backend o preenche hoje. Removido da tela de Venda até existir suporte real.
- **Estoque na tela Produtos**: o mock tinha um campo "estoque" editável direto no produto. No sistema real, estoque é do módulo Inventory (`StockItem` por depósito, via `POST /stock/movements`), não um campo do Product — fora do escopo desta migração de Catálogo. A tela Produtos não mostra nem edita estoque.
- **Produtos inativos**: `GET /products/search` só retorna produtos `active:true`. Depois de desativar um produto pela tela (o único "excluir" que existe), ele some da lista e não há como reativá-lo pela UI hoje (não existe endpoint pra listar inativos).

Ver [ELECTRON.md](./ELECTRON.md) para como esse build estático é empacotado.
