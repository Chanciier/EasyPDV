# Arquitetura — EasyPDV

## Filosofia

- **O Bling é só um Adapter.** O domínio nunca conhece o Bling diretamente — arquitetura Hexagonal (Ports & Adapters). Preparado para múltiplos ERPs futuros (Tiny, Omie, Conta Azul, ERP próprio), mas só o Adapter Bling é implementado na V1.
- **Venda sempre grava local primeiro.** O PDV nunca depende do Bling, nem de internet, para concluir uma venda. Sincronização é sempre assíncrona.
- **Multi-tenant, multi-loja, multi-depósito, múltiplas tabelas de preço desde o modelo de dados**, mesmo que a V1 opere com um valor fixo em cada dimensão.
- Domain-Driven Design com bounded contexts explícitos: Identity & Access, Catalog, Inventory, Customers, Sales, Fiscal, ERP Integration, Audit, Settings, Reporting.
- Auditoria e rastreabilidade são requisito de primeira classe, não add-on.

## Topologia (dois deployáveis)

```
PDV local (loja, .exe)          Intermediador (Railway)
┌──────────────────────┐         ┌───────────────────────┐
│ Electron              │        │ NestJS + PostgreSQL   │
│  ├─ pdv-frontend       │        │  ├─ ErpIntegration     │
│  └─ pdv-backend        │  ───►  │  ├─ ErpSyncMapping     │
│      (NestJS+SQLite)   │  HTTP  │  ├─ SyncJob (outbox)   │
│      Sales/Cash/       │        │  └─ Adapter Bling      │
│      Inventory/Catalog/│        └───────────┬───────────┘
│      Customers/Identity│                    │
└──────────────────────┘                    Bling API
```

- **PDV local**: roda inteiro dentro do `.exe` instalado no PC da loja. Banco SQLite (um arquivo por loja). Garante que a venda nunca depende de internet.
- **Intermediador**: hospedado no Railway, banco PostgreSQL + Redis/BullMQ. Único ponto que fala com o Bling — guarda credenciais OAuth por organização, roda o Adapter e a fila de sincronização.
- O PDV local nunca fala com o Bling diretamente, só com o Intermediador.

## Fluxo de dados

`PDV local (SQLite) → internet → Intermediador Railway (Postgres) → Bling`

Emissão fiscal também passa pelo Bling (via Intermediador) — por isso toda venda imprime um **comprovante não-fiscal na hora** (sempre funciona, local), e o documento fiscal de verdade chega em seguida, assíncrono.

## Documentos relacionados

- [DATABASE.md](./DATABASE.md) — entidades e onde cada uma mora
- [MODULES.md](./MODULES.md) — módulos do backend e seus limites de acesso
- [API.md](./API.md) — endpoints REST
- [EVENTS.md](./EVENTS.md) — catálogo de eventos internos
- [BACKEND.md](./BACKEND.md) / [FRONTEND.md](./FRONTEND.md) / [ELECTRON.md](./ELECTRON.md) — arquitetura interna de cada app
- [ERROR-HANDLING.md](./ERROR-HANDLING.md) — estratégia de tratamento de erro
- [ROADMAP.md](./ROADMAP.md) — sprints até a V1 comercial
- [CODING-STANDARDS.md](./CODING-STANDARDS.md) — padrões de código
- `docs/adr/` — decisões arquiteturais registradas com o porquê

Ver também o cofre Obsidian pessoal do usuário (`Claude/Projetos/EasyPDV/`) para o histórico de como essas decisões foram tomadas.
