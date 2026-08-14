# API REST — EasyPDV

## PDV local (`apps/pdv-backend`, porta 4001)

CORS liberado (`app.enableCors()`, Sprint 9) — o frontend Electron/Next roda em outra origem
(`http://localhost:3000` em dev) e autentica via Bearer token, não cookie, então CORS aberto
não expõe sessão a terceiros.

```
/health
POST   /auth/login     { email, password } → { user, tokens }
POST   /auth/refresh   { refreshToken } → tokens (rotaciona — o antigo é revogado)
POST   /auth/logout    { refreshToken } → revoga a sessão
GET    /auth/me        (Bearer token) → usuário atual
POST   /users          (Bearer + role administrador) → cria usuário
PATCH  /users/:id/role (Bearer + role administrador) → troca o papel

GET    /products/search?query=          (Bearer) → busca textual por nome/SKU, só produtos ativos, até 25
                                         (sem paginação — limite conhecido do V1, ver docs/CHANGELOG.md Sprint 9)
GET    /products/by-barcode/:code       (Bearer) → produto + preço vigente
GET    /products/:id/price              (Bearer) → preço vigente (ResolvePriceUseCase); 404 se produto
                                         sem preço na tabela ativa
GET    /products/:id                    (Bearer) → produto por id (Sprint 9 — frontend precisava resolver
                                         nome de produto a partir de SaleItem.productId)
POST   /products                        (Bearer + administrador/gerente) → cria produto
PATCH  /products/:id                    (Bearer + administrador/gerente) → atualiza produto; `active:false`
                                         é o único "excluir" que existe — sem hard delete (SKU pode estar
                                         referenciado em vendas já confirmadas)
POST   /products/:id/barcodes           (Bearer + administrador/gerente) → adiciona código de barras;
                                         sem endpoint pra listar os códigos já cadastrados de um produto

GET    /categories                      (Bearer) → lista
POST   /categories                      (Bearer + administrador/gerente) → cria

GET    /price-lists/active              (Bearer + administrador/gerente) → tabela de preço ativa (Sprint 9 —
                                         frontend precisava do id pra gravar preço de produto); null se nenhuma
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
PATCH  /cash/sessions/:id/close         (Bearer) → fecha sessão; calcula expectedAmount = abertura + suprimento - sangria + ajuste + vendas em dinheiro
POST   /cash/sessions/:id/movements     (Bearer) → registra sangria/suprimento/ajuste
GET    /cash/sessions/:id/movements     (Bearer) → lista movimentos da sessão, mais recente primeiro (Sprint 9)

GET    /sales?status=&cashSessionId=    (Bearer) → lista vendas (até 100, mais recente primeiro), com
                                         itens e pagamentos embutidos — usado pelo Histórico e pelo cálculo
                                         de "vendas em dinheiro" do Caixa no frontend (Sprint 9)
GET    /sales/:id                       (Bearer) → detalhe da venda com itens e pagamentos
POST   /sales                           (Bearer) → inicia venda (status draft), exige cashSessionId aberta
POST   /sales/:id/items                 (Bearer) → adiciona item (preço resolvido via Catalog); só em draft;
                                         sempre cria uma linha nova — não existe endpoint pra alterar
                                         quantidade de um item já existente (o frontend contorna com
                                         DELETE + POST, ver docs/FRONTEND.md)
DELETE /sales/:id/items/:itemId         (Bearer) → remove item; só em draft
POST   /sales/:id/payments              (Bearer) → registra pagamento (dinheiro/cartao/pix/outro); só em draft;
                                         cartão em V1 é declarado manualmente já "aprovado" (sem TEF, ver ROADMAP.md)
POST   /sales/:id/confirm               (Bearer) → confirma a venda: exige itens + pagamento total >= totalAmount;
                                         debita o estoque do depósito padrão numa transação atômica única
                                         (Sale.status→confirmed + StockMovement tipo "venda" + StockItem.decrement);
                                         409 se sem itens, sem pagamento suficiente, ou já não estiver em draft
POST   /sales/:id/cancel                (Bearer) → cancela; só em draft

GET    /sync/outbox?status=             (Bearer + administrador/gerente/tecnico) → lista entradas do
                                         outbox local (Central de Erros de Sincronização, Sprint 8)
POST   /sync/outbox/:id/retry           (Bearer + administrador/gerente/tecnico) → retry manual; só
                                         entradas "failed" (409 se não estiver, 404 se não existir)

/customers        + /:id/sales
/fiscal           documents/:saleId, reissue, cancel
/reports          sales, cash-sessions, stock, dashboard
/settings
/audit-logs
```

## Intermediador (`apps/intermediador`, porta 4002)

```
/health
POST   /sync              recebe uma entrada de sync do SyncOutboxWorker do PDV local
                           { entityType, entityId, payload, storeId? } → cria/reaproveita um SyncJob
                           (idempotente por entityType+entityId) e enfileira no BullMQ (fila "sync");
                           SEM autenticação por enquanto — provisionamento de terminal e autenticação
                           PDV local ↔ Intermediador ainda não existem (risco aberto, ver docs/ERROR-HANDLING.md)
GET    /sync/jobs?status=  lista SyncJobs (Central de Erros de Sincronização, Sprint 8)
GET    /sync/jobs/:id     status de um SyncJob (pending/processing/synced/failed)
POST   /sync/jobs/:id/retry  retry manual; só jobs "failed" (409 se não estiver, 404 se não existir) —
                           reset + reenfileira via UPDATE condicional atômico, evita dois retries
                           paralelos criarem pedidos duplicados no Bling (bug real encontrado e
                           corrigido nesta sprint, ver docs/CHANGELOG.md)

GET    /integrations/bling/connect?organizationId=   redireciona (302) pro fluxo de autorização OAuth2 do
                          Bling; abrir no navegador (não automatizável) — quem autoriza é o dono da conta Bling
GET    /integrations/bling/callback  recebido pelo Bling após autorização (code+state); troca o code por
                          token e grava em ErpIntegration
GET    /integrations/bling/status?organizationId=    { connected, connectedAt, expiresAt }

/organizations    provisionamento de organização/loja
/terminals        registro/ativação de terminal
```

Todos os endpoints acima estão sem autenticação por enquanto (mesmo risco aberto desde a Sprint 6 — ver docs/ERROR-HANDLING.md).

Schemas de request/response ficam em `packages/shared-validation` (Zod) e tipos em `packages/shared-types` — a mesma definição vale para o backend validar e o frontend tipar o client HTTP.

Endpoints detalhados por módulo entram conforme cada Sprint implementa o módulo correspondente — ver [ROADMAP.md](./ROADMAP.md).
