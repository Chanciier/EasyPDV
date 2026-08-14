# Changelog — EasyPDV

## [Unreleased]
### Sprint 8 — Central de Erros de Sincronização + reconciliação
- **Visibilidade e retry manual dos dois lados**: `GET /sync/outbox?status=` + `POST /sync/outbox/:id/retry` no PDV local; `GET /sync/jobs?status=` + `POST /sync/jobs/:id/retry` no Intermediador. Retry só aceita entradas/jobs "failed" (409 caso contrário, 404 se não existir).
- **`SyncJobReconciliationWorker`** (Intermediador, `@nestjs/schedule` `@Interval` a cada 2min): encontra `SyncJob`s travados em "processing" há mais de 5min (worker morreu ou Redis perdeu o job no meio do processamento) e marca "failed" com `lastError` explicando o motivo — não reenfileira sozinho, por design (reconciliação é manual, ver docs/ROADMAP.md). Resolve o risco #4 rastreado desde a Sprint 6/7 (perda de job em fila sem varredura de recuperação).
- **Bug real de concorrência encontrado e corrigido durante o teste** (não hipotético — reproduzido com duas requisições HTTP concorrentes de verdade): `POST /sync/jobs/:id/retry` chamado duas vezes rapidamente enfileirava dois jobs BullMQ em paralelo pro mesmo `SyncJob`, e como `createSalesOrder` não é idempotente, isso podia criar pedidos duplicados no Bling. Corrigido trocando `findById` + `update` incondicional por um `UPDATE` condicional atômico (`WHERE id=? AND status='failed'`) — mesma correção aplicada em `POST /sync/outbox/:id/retry` por consistência.
- Testado ponta a ponta com Postgres+Redis reais: retry de entrada/job "failed" (sucesso), retry de algo que não está "failed" (409), retry de id inexistente (404), duas requisições de retry concorrentes na mesma entrada/job (só uma vence, confirmado via log — só uma sequência de tentativas, sem duplicação), job seedado artificialmente travado em "processing" há 10min reconciliado pela varredura real no primeiro tick do `@Interval`.

### Sprint 7 — Adapter Bling (sincronização real ponta a ponta)
- **Fluxo OAuth2 completo e testado contra o Bling real**: `GET /integrations/bling/connect?organizationId=` gera o link de autorização (`state` codifica o organizationId, base64url); `GET /integrations/bling/callback` troca o `code` por token via `www.bling.com.br/Api/v3/oauth/token` (HTTP Basic client_id:client_secret) e grava em `ErpIntegration`; `BlingTokenProviderService` renova automaticamente via refresh_token quando o access_token está a menos de 60s de expirar — o Bling rotaciona o refresh_token a cada uso, os dois tokens são sempre persistidos juntos.
- Modelos `ErpIntegration` (credenciais OAuth por organização) e `ErpSyncMapping` (cache de IDs externos: produto por SKU, "Consumidor Final", venda→pedido) no Intermediador.
- `BlingApiClient`: `GET /produtos?codigo=`, `GET/POST /contatos`, `POST /pedidos/vendas` — confirmados contra `api.bling.com.br/Api/v3` real, não só a spec pública.
- **`BlingSyncTargetAdapter implements SyncTargetPort`** substitui o `NoopSyncTargetAdapter` da Sprint 6 sem tocar no `SyncProcessor` nem nos use-cases — exatamente a troca que a arquitetura Ports & Adapters foi desenhada pra permitir. Resolve produto por SKU (cacheado em `ErpSyncMapping`), contato padrão "Consumidor Final" (busca ou cria, cacheado), e cria o pedido de venda no Bling.
- Payload do `SyncOutbox`/`SyncJob` para `entityType="sale"` (Sprint 6) enriquecido com `sku`, `name` e `unitPrice` por item — o Intermediador nunca acessa o Catalog local, precisava desses dados "achatados" pra resolver o produto no Bling. Tipo `SaleSyncPayload` centralizado em `@easypdv/shared-types` pra manter os dois lados em sincronia.
- **Descoberta real durante o teste**: Bling não expõe endpoint de listagem de formas de pagamento (suposição inicial errada) — o id (`BLING_DEFAULT_PAYMENT_METHOD_ID`) vem de configuração, obtido manualmente no painel do Bling ou inspecionando um pedido existente via `GET /pedidos/vendas/:id`. V1 usa uma única forma de pagamento fixa pra todo pedido, independente da forma real da venda local — simplificação documentada, não bloqueia a V1.
- **Testado ponta a ponta contra o Bling real do usuário** (não simulado): venda confirmada no pdv-backend → outbox → `SyncJob` → `BlingSyncTargetAdapter` → pedido de venda criado de verdade no Bling (conferido campo a campo via `GET /pedidos/vendas/:id`: contato, itens, quantidade, valor unitário, total e forma de pagamento todos batendo com a venda local).
- `docs/BACKEND.md` ganhou uma seção sobre o padrão de client gerado próprio por app em monorepos Prisma (lição da Sprint 6, reaproveitada aqui sem repetir o bug).

### Sprint 6 — Outbox, Fila e Workers
- **PDV local**: modelo `SyncOutbox` (transactional outbox) — `PrismaSaleRepository.confirm()` grava uma entrada `entityType="sale"` na mesma transação do `SaleConfirmed` (mesma exceção pragmática já usada pro débito de estoque). `SyncOutboxWorker` (`@nestjs/schedule`, a cada 15s) varre entradas `pending` e faz `POST /sync` no Intermediador via `HttpSyncGateway`; sucesso marca `synced`, falha incrementa `attempts` e retenta (teto de 5 antes de virar `failed`). Endpoint `GET /sync/outbox` para visibilidade/depuração.
- **Intermediador**: modelo `SyncJob` (Postgres) + fila BullMQ (`@nestjs/bullmq`, Redis). `POST /sync` cria (ou reaproveita, idempotente por `@@unique([entityType, entityId])`) um `SyncJob` e enfileira; `SyncProcessor` (worker BullMQ) processa cada job via `SyncTargetPort` — Sprint 6 só tem o `NoopSyncTargetAdapter` (loga e confirma "synced", sem falar com nenhum ERP de verdade), Sprint 7 substitui pelo Adapter Bling sem tocar no processor. `GET /sync/jobs/:id` consulta status.
- Scaffolding base do Intermediador completado: `PrismaModule`/`PrismaService`, `ConfigModule`, `BullModule`, `DomainError`/`DomainExceptionFilter` — mesmo padrão já usado no pdv-backend.
- **Bug real de monorepo encontrado e corrigido**: pdv-backend e intermediador compartilham a mesma versão de `@prisma/client`, que o pnpm deduplica numa única pasta física — `prisma generate` de um app sobrescrevia o client gerado do outro (schemas diferentes, mesmo destino), quebrando em runtime quem não gerou por último. Só apareceu ao rodar os dois servidores juntos pela primeira vez (nenhuma sprint anterior precisou disso). Corrigido dando ao intermediador um `output` próprio (`src/generated/prisma`) no `generator client`, com ajustes em `tsconfig.json` (exclude), `nest-cli.json` (assets copiados pro `dist/`) e `eslint-config` (`**/generated/**` ignorado). Ver docs/BACKEND.md.
- `docker-compose.yml`: portas de Postgres/Redis viraram configuráveis via env (`POSTGRES_PORT`/`REDIS_PORT`, default 5433/6380) — a máquina de dev já tinha outro projeto ocupando 5432/6379.
- Testado ponta a ponta manualmente com Postgres+Redis reais via Docker: venda confirmada → outbox local `synced` → `SyncJob` criado e processado (`synced`, 1 tentativa) no Intermediador → reenvio do mesmo `entityId` não duplica o job (idempotência confirmada) → `GET /sync/jobs/:id` inexistente retorna 404.
- **Gap aberto e documentado**: `POST /sync` sem autenticação (provisionamento de terminal é Sprint 10); varredura de reconciliação para `SyncJob`s órfãos por perda do Redis fica pra Central de Erros de Sincronização (Sprint 8). Ver docs/ERROR-HANDLING.md.

### Sprint 5 — Pagamentos + Confirmação
- Modelo `Payment` (method: dinheiro/cartao/pix/outro; status: aprovado/pendente/recusado — em V1 sem TEF/gateway real, cartão entra direto "aprovado" pois a maquininha física já aprovou, ver docs/ROADMAP.md).
- `RegisterPaymentUseCase`: registra pagamento numa venda em draft.
- `ConfirmSaleUseCase`: exige venda em draft, com itens, e pagamentos aprovados cobrindo o total (`InsufficientPaymentError` caso contrário); resolve o depósito padrão via `ListWarehousesUseCase` (exportado pelo `InventoryModule`, mesmo padrão de injeção cross-módulo já usado com `ResolvePriceUseCase` na Sprint 4).
- **Evento central `SaleConfirmed` implementado**: `PrismaSaleRepository.confirm()` atualiza `Sale.status` para `confirmed` e debita o estoque de cada item (`StockMovement` tipo "venda" + `StockItem.decrement`) numa única transação Prisma — exceção deliberada e documentada à separação estrita de dados por módulo, justificada pela exigência de atomicidade (a camada de use-case continua dependendo só de `SaleRepositoryPort`).
- **Race condition de estoque resolvida** (risco aberto desde a Sprint 3): débito via `{ decrement: n }` do Prisma (SQL `UPDATE ... SET quantity = quantity - n` atômico) em vez de read-modify-write em código de aplicação; combinado com a serialização de escrita do SQLite, elimina a corrupção quando dois caixas confirmam o mesmo produto ao mesmo tempo. Validado empiricamente: duas confirmações simultâneas debitando 5 unidades cada de um estoque de 60 resultaram em 50, com dois `StockMovement` distintos — nenhuma escrita perdida. Ver docs/ERROR-HANDLING.md.
- Endpoints: `POST /sales/:id/payments`, `POST /sales/:id/confirm`.
- Testado ponta a ponta manualmente: confirmação de venda sem itens (409), sem pagamento (409), com pagamento parcial (409), pagamento completo + confirmação (201, estoque debitado, `StockMovement` conferido), reconfirmação de venda já confirmada (409), e o teste de concorrência descrito acima.

### Sprint 4 — Caixa e Venda (núcleo)
- Módulo Sales completo em `apps/pdv-backend` (bundla Caixa + Venda, conforme docs/MODULES.md): CashRegister, CashSession, CashMovement, Sale, SaleItem.
- Caixa: abrir sessão (409 se já existe uma aberta no registrador), sangria/suprimento/ajuste, fechar com cálculo automático de `expectedAmount` (abertura + suprimento - sangria + ajuste), sessão atual do operador.
- Venda: iniciar (draft, exige sessão de caixa aberta), adicionar/remover item (preço resolvido via `CatalogModule.ResolvePriceUseCase`, exportado para consumo entre módulos), cancelar — total recalculado a cada mudança de item.
- **Escopo deliberadamente limitado**: sem desconto, sem Payment, sem confirmação — venda só transita entre `draft` e `cancelled`. `confirmed` + débito de estoque + Payment entram juntos na Sprint 5, numa única transação atômica (é o "evento central" `SaleConfirmed` documentado desde o início).
- Seed estendido com um `CashRegister` ("Caixa 1").
- Testado ponta a ponta manualmente: abrir/duplicar-caixa (409), sangria/suprimento, iniciar venda, adicionar 2 itens (total conferido), remover item (total recalculado), cancelar (imutabilidade depois confirmada com 409), fechar caixa com divergência zero conferida.

### Sprint 3 — Estoque
- Módulo Inventory completo em `apps/pdv-backend`: Warehouse, StockItem (saldo materializado), StockMovement (ledger append-only) — registro de movimento grava as duas tabelas na mesma transação Prisma.
- Endpoints: consultar saldo, listar movimentos, registrar movimento (`quantity` sempre como delta assinado). Mutações protegidas por RBAC (`administrador`/`gerente`/`supervisor`).
- Seed estendido com depósito "Depósito Principal" e estoque inicial para os 3 produtos de exemplo.
- **Bug real encontrado e corrigido em todos os módulos**: `@UsePipes(new ZodValidationPipe(schema))` no nível do método aplicava o mesmo pipe a todos os parâmetros do handler, não só ao `@Body()` — quebrava qualquer rota com `@Param()` ou `@CurrentUser()` além do body (`PATCH /users/:id/role`, `PATCH /products/:id`, `POST /products/:id/barcodes`, `POST /price-lists/:id/items`, `POST /stock/movements`). Corrigido movendo a validação para `@Body(new ZodValidationPipe(schema))` no parâmetro, em todos os controllers — regra registrada em `docs/CODING-STANDARDS.md` para não repetir.
- Banco de dev resetado (`prisma migrate reset`, com consentimento explícito do usuário — Prisma bloqueia essa operação para agentes de IA por padrão) para limpar dados de teste e validar o seed do zero.
- Testado ponta a ponta manualmente, incluindo as rotas que estavam quebradas: entrada/saída de estoque com saldo final conferido, `PATCH /users/:id/role`, `PATCH /products/:id`, RBAC.

### Sprint 2 — Catálogo
- Módulo Catalog completo em `apps/pdv-backend`: Product, Category, Barcode, PriceList/PriceListItem (domain/application/infrastructure), incluindo `ResolvePriceUseCase` (preço vigente + promocional).
- Endpoints: busca textual, busca por código de barras (retorna produto + preço), CRUD de produto/categoria/tabela de preço — mutações protegidas por RBAC (`administrador`/`gerente`).
- Erros de domínio refatorados para uma base comum (`DomainError` com `kind`) — o filtro HTTP global não precisa mais importar erros de cada módulo individualmente, evitando que esse arquivo cresça sem limite a cada sprint.
- Seed estendido com catálogo de exemplo (3 produtos, 1 categoria, tabela "Padrão").
- Testado ponta a ponta manualmente: busca por barcode com preço, busca textual, criação de produto, conflito de SKU (409), preço ausente (404), criação de tabela de preço, RBAC negando operador.
- Lição de teste (não é bug do produto): comandos `curl` com acento digitado direto no Git Bash deste Windows corrompem o payload UTF-8 antes de sair do curl — usar texto sem acento ou arquivo `-d @file.json` em smoke tests futuros.

### Sprint 1 — Identidade e Acesso
- Módulo Identity & Access completo em `apps/pdv-backend` (domain/application/infrastructure): login, refresh token com rotação, logout, `/auth/me`, criação de usuário e troca de papel protegidas por RBAC (`administrador`).
- JWT de acesso curto + refresh token opaco (hash bcrypt, sessão em `AuthSession`, nunca guardado em texto puro).
- Seed (`prisma/seed.ts`) cria o primeiro Administrador em dev local.
- `packages/shared-types`, `shared-events` e `shared-validation` ganharam passo de build real (`tsc` → `dist/`) — eram consumidos como fonte TS direta, o que quebrava em runtime (Node não resolve `.js` de um `.ts` sem compilar). Bug encontrado só no smoke test manual, não no typecheck/build.
- Fluxo testado ponta a ponta manualmente: login, `/auth/me`, refresh (com rotação e rejeição de reuso), RBAC negando `operador` em rota de administrador.

### Sprint 0 — Fundação técnica
- Monorepo pnpm + Turborepo criado (`apps/pdv-frontend`, `apps/pdv-backend`, `apps/intermediador`, `apps/electron`, `packages/*`).
- Frontend existente (protótipo v0.app) integrado sem reescrita.
- Documentação de arquitetura populada em `/docs` (ver ADRs 0001-0003).
