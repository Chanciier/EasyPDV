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

GET    /provisioning/status             SEM auth — chamado pelo Electron (main process) antes de
                                         qualquer login existir. { activated, organizationId, storeId,
                                         storeName }. Sprint 10.
POST   /provisioning/activate           SEM auth (mesma razão) → { code, terminalName? }. Chama
                                         POST /terminals/activate no Intermediador e persiste o resultado
                                         (incluindo a apiKey em texto puro) em StoreIdentity local; 409 se
                                         este terminal já foi ativado antes (uma linha só, ver docs/DATABASE.md)
GET    /provisioning/busy-status        SEM auth → { hasOpenCashSession }, qualquer caixa do terminal (não
                                         escopado por operador). Consultado pelo Electron antes de aplicar
                                         uma atualização baixada — nunca no meio de uma venda.

/customers        + /:id/sales
/fiscal           documents/:saleId, reissue, cancel
/reports          sales, cash-sessions, stock, dashboard
/settings
/audit-logs
```

## Intermediador (`apps/intermediador`, porta 4002)

```
/health
POST   /sync              chamado pelo SyncOutboxWorker do PDV local — exige apiKey de terminal
                           (Sprint 10, TerminalApiKeyGuard, header X-Terminal-Api-Key; 401 sem ela ou
                           inválida) { entityType, entityId, payload } → cria/reaproveita um SyncJob
                           (idempotente por entityType+entityId) e enfileira no BullMQ (fila "sync").
                           storeId nunca vem do body — é o do terminal autenticado (fecha o risco #6
                           de Decisões e Riscos Abertos, ver docs/CHANGELOG.md Sprint 10)
GET    /sync/jobs?status=  lista SyncJobs (Central de Erros de Sincronização, Sprint 8) — SEM auth,
                           é visibilidade/retry pra um administrador, não uma chamada de terminal;
                           precisaria de auth de admin (ainda não existe), risco aberto e rastreado
GET    /sync/jobs/:id     status de um SyncJob (pending/processing/synced/failed)
POST   /sync/jobs/:id/retry  retry manual; só jobs "failed" (409 se não estiver, 404 se não existir) —
                           reset + reenfileira via UPDATE condicional atômico, evita dois retries
                           paralelos criarem pedidos duplicados no Bling (bug real encontrado e
                           corrigido na Sprint 8, ver docs/CHANGELOG.md)

GET    /integrations/bling/connect?organizationId=   redireciona (302) pro fluxo de autorização OAuth2 do
                          Bling; abrir no navegador (não automatizável) — quem autoriza é o dono da conta Bling
GET    /integrations/bling/callback  recebido pelo Bling após autorização (code+state); troca o code por
                          token e grava em ErpIntegration
GET    /integrations/bling/status?organizationId=    { connected, connectedAt, expiresAt }

POST   /organizations                     SEM auth (bootstrapping — sem UI de admin ainda, uso via
                                           curl/Postman) { name, document? } → cria Organization. Sprint 10.
POST   /organizations/:id/activation-codes  { storeId } (loja existente, novo terminal na mesma loja) OU
                                           { storeName } (cria loja nova) → gera um código de 8 caracteres
                                           (alfabeto sem 0/O/1/I/L), expira em 30min, uso único
POST   /terminals/activate                { code, terminalName? } → valida o código (404 inválido, 409
                                           expirado ou já usado — UPDATE condicional atômico evita corrida
                                           em duas ativações simultâneas com o mesmo código), cria Terminal
                                           e retorna { terminalId, organizationId, storeId, storeName,
                                           apiKey } — apiKey em texto puro só nesta resposta, nunca
                                           persistida aqui (só o hash SHA-256, Terminal.apiKeyHash)
```

Endpoints de `/organizations` e `/terminals` seguem sem autenticação (bootstrapping manual, sem UI de admin ainda). Os demais endpoints sem `(Bearer)`/apiKey explícitos acima seguem sem autenticação (mesmo risco aberto desde a Sprint 6 — ver docs/ERROR-HANDLING.md); `POST /sync` é o único endpoint do Intermediador com autenticação real até agora (apiKey de terminal, Sprint 10).

Schemas de request/response ficam em `packages/shared-validation` (Zod) e tipos em `packages/shared-types` — a mesma definição vale para o backend validar e o frontend tipar o client HTTP.

Endpoints detalhados por módulo entram conforme cada Sprint implementa o módulo correspondente — ver [ROADMAP.md](./ROADMAP.md).
