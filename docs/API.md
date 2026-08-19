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
GET    /users          (Bearer + role administrador) → lista todos, ordenado por `employeeCode` asc.
                        Sprint 16, tela "Administração" (aba Usuários)
POST   /users          (Bearer + role administrador) → cria usuário; `employeeCode` calculado no
                        backend (max atual + 1, ver docs/DATABASE.md), nunca enviado pelo cliente
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

GET    /stock                           (Bearer) → estoque de TODO o catálogo do depósito padrão num
                                         tiro só, `{ productId, quantity }[]` — só produto com
                                         StockItem materializado aparece (equivalente a 0 se ausente).
                                         Alimenta a coluna "Estoque" da tela Produtos (2026-08-19)
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
                                         DELETE + POST, ver docs/FRONTEND.md). 409 se a quantidade pedida
                                         excede o estoque disponível no depósito padrão (InsufficientStockError,
                                         2026-08-19) — checagem cedo, não é a garantia final (essa é em
                                         POST /sales/:id/confirm)
DELETE /sales/:id/items/:itemId         (Bearer) → remove item; só em draft
POST   /sales/:id/payments              (Bearer) → registra pagamento (dinheiro/cartao/pix/outro); só em draft;
                                         cartão em V1 é declarado manualmente já "aprovado" (sem TEF, ver ROADMAP.md).
                                         cardType (credito/debito) e installments são opcionais, só fazem
                                         sentido com method="cartao" (Sprint 14)
PATCH  /sales/:id/discount              (Bearer) → aplica desconto fixo (R$) no total da venda; só em draft;
                                         409 se discountAmount > subtotal (Sprint 14). Sem alçada — qualquer
                                         operador autenticado pode aplicar, mesmo padrão de sangria/suprimento
POST   /sales/:id/confirm               (Bearer) → confirma a venda: exige itens + pagamento total >= totalAmount;
                                         debita o estoque do depósito padrão numa transação atômica única
                                         (Sale.status→confirmed + StockMovement tipo "venda" + StockItem.decrement);
                                         409 se sem itens, sem pagamento suficiente, ou já não estiver em draft
POST   /sales/:id/cancel                (Bearer) → cancela; só em draft
POST   /sales/:id/void                  (Bearer + administrador/gerente) → estorna uma venda já CONFIRMADA
                                         (Sprint 14): { reason } obrigatório. Reverte o débito de estoque
                                         (StockMovement tipo "devolucao", positivo, no mesmo depósito
                                         debitado por confirm) numa transação atômica, reaproveita
                                         SaleStatus "cancelled" (distinção com cancelamento de rascunho via
                                         confirmedAt !== null). 409 se a venda não estiver confirmada OU se
                                         já existe um documento fiscal emitido pra ela (guarda-corrimão
                                         deliberado — não propaga o estorno pro Bling nem cancela a NFC-e
                                         na SEFAZ, lacuna aceita e documentada, ver Decisões e Riscos Abertos)

GET    /sales/:saleId/fiscal            (Bearer) → status fiscal da NFC-e (Sprint 12): busca ao vivo no
                                         Intermediador (GET /fiscal/sale/:saleId lá) e espelha localmente
                                         (FiscalDocument, SQLite); se o Intermediador estiver inacessível,
                                         cai pro que já está espelhado em vez de falhar a tela inteira.
                                         `null` é normal — nem toda venda tem NFC-e (emissão é opt-in,
                                         BLING_NFCE_AUTO_EMIT no Intermediador, default desligado).
                                         qrCodeUrl (Sprint 14) vem do XML autorizado do Bling
                                         (<infNFeSupl><qrCode>), usado pra imprimir o cupom fiscal real

GET    /sync/status                     (Bearer, qualquer papel) → { pendingCount, failedCount } do
                                         outbox local (Sprint 15, Modo contingência). Deliberadamente SEM
                                         @Roles — ao contrário de GET /sync/outbox (detalhado), qualquer
                                         operador precisa ver que a sincronização está pendente/falhando,
                                         não só a gestão. Só contagem, sem os payloads
GET    /sync/outbox?status=             (Bearer + administrador/gerente/tecnico) → lista entradas do
                                         outbox local (Central de Erros de Sincronização, Sprint 8)
POST   /sync/outbox/:id/retry           (Bearer + administrador/gerente/tecnico) → retry manual; só
                                         entradas "failed" (409 se não estiver, 404 se não existir)

GET    /audit-logs?entityType=&userId=&from=&to=  (Bearer + administrador/gerente/auditor) → trilha de
                                         eventos sensíveis (Sprint 13): venda confirmada/cancelada, caixa
                                         aberto/fechado, movimento de caixa, papel de usuário alterado,
                                         preço alterado, movimento de estoque manual. `sale.confirmed` é o
                                         único gravado na mesma transação da ação (evento central do
                                         sistema); os demais gravam logo depois, sem essa garantia —
                                         simplificação V1 deliberada, ver docs/DATABASE.md

GET    /reports/dashboard               (Bearer, qualquer papel) → resumo do dia agregado no banco
                                         (Sprint 13): { todaySalesCount, todaySalesTotal, averageTicket,
                                         openCashSessionsCount }. Sem o cap de 100 registros que GET /sales
                                         tem — corrige o Histórico, que somava client-side uma lista já
                                         paginada
GET    /reports/sales?from=&to=         (Bearer + administrador/gerente/proprietario) → agregado por dia
                                         no intervalo (default: últimos 30 dias)
GET    /reports/cash-sessions?from=&to= (Bearer + administrador/gerente/proprietario) → sessões
                                         fechadas no intervalo, com divergência (closingAmount -
                                         expectedAmount) calculável no frontend a partir dos campos já
                                         presentes em CashSession
GET    /reports/stock?warehouseId=      (Bearer + administrador/gerente/proprietario) → saldo atual por
                                         depósito/produto. Tela "Relatórios" no frontend (Sprint 15)
                                         consome os três (`reports-view.tsx`)

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
POST   /provisioning/activation-codes   (Bearer + role administrador) → sem body → gera código de ativação
                                         pra um terminal NOVO na MESMA loja do terminal que está pedindo
                                         (V1 não cria loja nova por aqui — decisão do usuário: hoje só existe
                                         uma conta Bling conectada, e lojas diferentes exigiriam contas Bling
                                         diferentes, então "loja nova" não é um caso real ainda). Delega pro
                                         Intermediador (POST /organizations/:id/activation-codes com
                                         { storeId: <loja do terminal> }, apiKey do terminal local);
                                         { code, expiresAt, storeId, storeName }. Tela "Administração" (aba
                                         "Ativar novo terminal"), Sprint 16 — antes só existia via curl
                                         direto no Intermediador, sem nenhuma autenticação

GET    /customers?query=                (Bearer) → busca por nome ou documento (Sprint 15), até 25,
                                         ordenado por nome. Sem query, lista os primeiros 25
GET    /customers/:id                   (Bearer) → detalhe
POST   /customers                       (Bearer) → cria; só `name` obrigatório
PATCH  /customers/:id                   (Bearer) → atualiza campos parciais
DELETE /customers/:id                   (Bearer + administrador/gerente) → exclui; vendas já vinculadas
                                         não são apagadas nem bloqueadas — Sale.customerId vira null
                                         (onDelete: SetNull), a venda passa a exibir "Consumidor Final"
```

### Realtime (WebSocket, Sprint 13)

`RealtimeGateway` (`@nestjs/websockets` + `socket.io`, mesma porta 4001) — **sem autenticação por design**, mesma fronteira de confiança do resto da API local (o backend só escuta em 127.0.0.1; o payload não carrega nada que o cliente não já veria via REST autenticado). Broadcast pra todo cliente conectado, sem sala/escopo por usuário:

```
sale.confirmed          { saleId, totalAmount, confirmedAt } — emitido por SalesController após POST /sales/:id/confirm
sale.voided             { saleId, reason } — emitido por SalesController após POST /sales/:id/void (Sprint 14)
cash_session.opened     { sessionId, cashRegisterId } — emitido por CashController após POST /cash/sessions
cash_session.closed     { sessionId, cashRegisterId } — emitido por CashController após PATCH /cash/sessions/:id/close
```

Nenhuma tela depende disso pra funcionar corretamente — quem fez a mutação já teve seu próprio cache do TanStack Query atualizado via `onSuccess`; é só pra **outras** abas/sessões conectadas ao mesmo `pdv-backend` (ex: um painel de acompanhamento numa segunda tela) verem em tempo real, sem polling. Testado de verdade com duas abas do navegador: venda confirmada numa aba atualizou o resumo do dia e a lista de vendas da outra aba sem nenhum refresh manual.

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

GET    /fiscal/sale/:saleId  chamado pelo PDV local — exige apiKey de terminal (mesmo guard de POST /sync).
                           Status da NFC-e emitida pra essa venda (Sprint 12): { type, status,
                           documentNumber, accessKey, danfeUrl, qrCodeUrl, errorMessage, issuedAt }; 404 se
                           a venda não tem documento fiscal (emissão é opt-in, ver BLING_NFCE_AUTO_EMIT
                           abaixo). qrCodeUrl (Sprint 14) é extraído do XML autorizado devolvido pelo Bling
                           (tag <infNFeSupl><qrCode>, padrão nacional NFC-e) — nunca reconstruído a partir
                           de UF+chave

POST   /organizations                     SEM auth (bootstrapping — sem UI de admin ainda, uso via
                                           curl/Postman) { name, document? } → cria Organization. Sprint 10.
                                           Chicken-and-egg deliberado: é o único jeito de nascer o PRIMEIRO
                                           terminal de uma organização nova, continua fora do escopo da
                                           tela "Administração" (Sprint 16) — uso interno meu, não do cliente
POST   /organizations/:id/activation-codes  TerminalApiKeyGuard (Sprint 16 — antes SEM auth nenhuma) + o
                                           terminal autenticado precisa pertencer à MESMA organização do
                                           `:id` da URL (403 OrganizationMismatchError, senão qualquer
                                           terminal ativado poderia gerar código pra organização de outro
                                           cliente). { storeId } (loja existente, novo terminal na mesma
                                           loja — é o único caminho que a rota do pdv-backend usa hoje) OU
                                           { storeName } (cria loja nova, sem UI ainda) → gera um código de
                                           8 caracteres (alfabeto sem 0/O/1/I/L), expira em 30min, uso único.
                                           **Correção de segurança (Sprint 16)**: `storeId` agora confere
                                           que a loja pertence à MESMA organização do `:id` da URL (senão
                                           404, tratado como "não encontrada" — não confirma pra quem
                                           chamou que aquele storeId existe de fato só que é de outro
                                           cliente); antes disso, um storeId de outra organização era aceito
                                           sem checagem
POST   /terminals/activate                { code, terminalName? } → valida o código (404 inválido, 409
                                           expirado ou já usado — UPDATE condicional atômico evita corrida
                                           em duas ativações simultâneas com o mesmo código), cria Terminal
                                           e retorna { terminalId, organizationId, storeId, storeName,
                                           apiKey } — apiKey em texto puro só nesta resposta, nunca
                                           persistida aqui (só o hash SHA-256, Terminal.apiKeyHash).
                                           Sprint 16: dispara em background (fire-and-forget, não bloqueia
                                           esta resposta) uma importação do catálogo do Bling da
                                           organização, se ela tiver integração conectada — erro (ex: sem
                                           Bling conectado) só loga, nunca falha a ativação

GET    /integrations/bling/products?since=  chamado pelo pdv-backend (botão "Sincronizar com Bling",
                                           sync automático na ativação, e o poll periódico de estoque —
                                           ver BlingStockSyncWorker) — exige apiKey de terminal, organização
                                           vem do terminal autenticado (@CurrentTerminal), não de query
                                           param. **Bug corrigido na Sprint 16**: resolvia a integração Bling
                                           via `findFirstActive("bling")` (primeira conexão ativa em TODO o
                                           Intermediador, "simplificação single-tenant" documentada no
                                           próprio código) — inofensivo enquanto só existia 1 organização
                                           real, mas exporia dados de uma organização pra outra assim que uma
                                           segunda existisse. Agora usa
                                           `findByOrganization(terminal.organizationId, "bling")`.
                                           `since` (opcional, ISO) — adicionado 2026-08-19 pro sync
                                           bidirecional de estoque: filtra só produtos alterados no Bling a
                                           partir dessa data (`dataAlteracaoInicial`, formato `YYYY-MM-DD`
                                           com 1 dia de folga pra trás contra fuso horário). Sem `since`,
                                           catálogo inteiro (comportamento de sempre)
```

Endpoints de `/organizations` e `/terminals` seguem sem autenticação (bootstrapping manual, sem UI de admin ainda). Os demais endpoints sem `(Bearer)`/apiKey explícitos acima seguem sem autenticação (mesmo risco aberto desde a Sprint 6 — ver docs/ERROR-HANDLING.md); `POST /sync` é o único endpoint do Intermediador com autenticação real até agora (apiKey de terminal, Sprint 10).

Schemas de request/response ficam em `packages/shared-validation` (Zod) e tipos em `packages/shared-types` — a mesma definição vale para o backend validar e o frontend tipar o client HTTP.

Endpoints detalhados por módulo entram conforme cada Sprint implementa o módulo correspondente — ver [ROADMAP.md](./ROADMAP.md).
