# Arquitetura do Backend — EasyPDV

Vale para `apps/pdv-backend` e `apps/intermediador` — mesma estrutura interna, bancos e responsabilidades diferentes (ver [ARCHITECTURE.md](./ARCHITECTURE.md)).

## Estrutura por módulo

```
src/modules/<nome>/
├── domain/          # Entities, Value Objects, Specifications, Policies
├── application/     # Use Cases, DTOs, Ports (interfaces)
└── infrastructure/  # Controllers, Repositories (Prisma), Mappers, Adapters
```

Direção de dependência sempre de fora para dentro: `infrastructure` depende de `application`/`domain`; `domain` não depende de nada externo.

## Comunicação entre módulos

1. **Leitura síncrona** via injeção de dependência do Nest — quando um módulo só precisa consultar outro (ex: Sales consulta Catalog para resolver preço).
2. **Reação assíncrona via evento** — quando um módulo reage a uma mudança de outro sem se acoplar a ele (ex: Inventory reage a `SaleConfirmed`).

## Fluxo de requisição

`Guard (JWT + RBAC por loja)` → `Pipe (validação Zod)` → `Controller` (fino, sem regra de negócio) → `Use Case` → `Domain` → `Repository (Prisma)` → commit → `Response DTO`.

## Fluxo de eventos (transactional outbox)

Na mesma transação que grava a mudança de estado, o Use Case grava uma linha na tabela de outbox (`SyncOutbox` local / `SyncJob` no Intermediador) — garante que o evento nunca se perde mesmo se a fila estiver indisponível no instante da gravação. Depois do commit, listeners in-process (Audit) reagem na hora; um relay lê a outbox e publica para os consumidores que cruzam processo.

## Workers (só no Intermediador)

Processo separado consumindo as filas BullMQ (`erp-sync`, `fiscal-emission`), reutilizando os mesmos Use Cases/Adapters da API — nunca duplicando regra de negócio.

## Autenticação

JWT de acesso curto + refresh token (hash em `AuthSession`, rotacionado a cada uso). Guard de RBAC lê o papel do usuário escopado pela loja ativa.

Ver [MODULES.md](./MODULES.md) para a lista completa de módulos e [CODING-STANDARDS.md](./CODING-STANDARDS.md) para os padrões de DTO/Entity/UseCase/Repository/Adapter/Specification/Policy.
