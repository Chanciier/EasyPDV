# Changelog — EasyPDV

## [Unreleased]
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
