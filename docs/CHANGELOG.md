# Changelog — EasyPDV

## [Unreleased]
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
