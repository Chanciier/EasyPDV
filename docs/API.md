# API REST — EasyPDV

## PDV local (`apps/pdv-backend`, porta 4001)

```
/health
POST   /auth/login     { email, password } → { user, tokens }
POST   /auth/refresh   { refreshToken } → tokens (rotaciona — o antigo é revogado)
POST   /auth/logout    { refreshToken } → revoga a sessão
GET    /auth/me        (Bearer token) → usuário atual
POST   /users          (Bearer + role administrador) → cria usuário
PATCH  /users/:id/role (Bearer + role administrador) → troca o papel

GET    /products/search?query=          (Bearer) → busca textual por nome/SKU
GET    /products/by-barcode/:code       (Bearer) → produto + preço vigente
GET    /products/:id/price              (Bearer) → preço vigente (ResolvePriceUseCase)
POST   /products                        (Bearer + administrador/gerente) → cria produto
PATCH  /products/:id                    (Bearer + administrador/gerente) → atualiza produto
POST   /products/:id/barcodes           (Bearer + administrador/gerente) → adiciona código de barras

GET    /categories                      (Bearer) → lista
POST   /categories                      (Bearer + administrador/gerente) → cria

POST   /price-lists                     (Bearer + administrador/gerente) → cria tabela de preço
POST   /price-lists/:id/items           (Bearer + administrador/gerente) → define/atualiza preço de um produto

GET    /warehouses                      (Bearer) → lista
POST   /warehouses                      (Bearer + administrador/gerente) → cria depósito

GET    /stock/:warehouseId/:productId   (Bearer) → saldo atual (zerado se nunca movimentado)
GET    /stock/movements?warehouseId=&productId=  (Bearer) → últimos 100 movimentos
POST   /stock/movements                 (Bearer + administrador/gerente/supervisor) → registra movimento;
                                         `quantity` é sempre o delta assinado (negativo para saída)

GET    /cash/registers                  (Bearer) → lista caixas
POST   /cash/registers                  (Bearer + administrador/gerente) → cria caixa
GET    /cash/sessions/current           (Bearer) → sessão aberta do operador atual (null se nenhuma)
GET    /cash/sessions/:id               (Bearer) → detalhe da sessão
POST   /cash/sessions                   (Bearer) → abre sessão (409 se já existe uma aberta no caixa)
PATCH  /cash/sessions/:id/close         (Bearer) → fecha sessão; calcula expectedAmount = abertura + suprimento - sangria + ajuste
POST   /cash/sessions/:id/movements     (Bearer) → registra sangria/suprimento/ajuste

GET    /sales/:id                       (Bearer) → detalhe da venda com itens
POST   /sales                           (Bearer) → inicia venda (status draft), exige cashSessionId aberta
POST   /sales/:id/items                 (Bearer) → adiciona item (preço resolvido via Catalog); só em draft
DELETE /sales/:id/items/:itemId         (Bearer) → remove item; só em draft
POST   /sales/:id/cancel                (Bearer) → cancela; só em draft

/customers        + /:id/sales
/payments         Sprint 5 — pagamento + confirmação da venda
/fiscal           documents/:saleId, reissue, cancel
/reports          sales, cash-sessions, stock, dashboard
/settings
/audit-logs
```

## Intermediador (`apps/intermediador`, porta 4002)

```
/health
/organizations    provisionamento de organização/loja
/terminals        registro/ativação de terminal
/sync             POST recebido do PDV local (SyncRequested), status de jobs
/integrations     conexão com Bling, status, retry de sync-job
```

Schemas de request/response ficam em `packages/shared-validation` (Zod) e tipos em `packages/shared-types` — a mesma definição vale para o backend validar e o frontend tipar o client HTTP.

Endpoints detalhados por módulo entram conforme cada Sprint implementa o módulo correspondente — ver [ROADMAP.md](./ROADMAP.md).
