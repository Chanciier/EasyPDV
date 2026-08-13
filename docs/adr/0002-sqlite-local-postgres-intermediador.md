# ADR 0002 — SQLite no PDV local, PostgreSQL no Intermediador

## Status
Aceita (2026-08-13)

## Contexto
O stack "oficial" definido durante o planejamento era Prisma + PostgreSQL em todo lugar. Ao decidir que o backend do PDV roda dentro do `.exe` da loja (ADR 0001), rodar um processo PostgreSQL separado em cada instalação se tornou impraticável de empacotar e manter em centenas de lojas sem TI própria.

## Decisão
`apps/pdv-backend` usa **SQLite** via Prisma (mesmo padrão de código, provider diferente no schema). `apps/intermediador` mantém **PostgreSQL**, onde multi-tenancy e concorrência real de fato importam.

## Consequências
- Cada loja é single-tenant por definição no banco local — reduz a necessidade de isolamento por `organizationId` ali (o Intermediador é quem precisa disso a sério).
- Prisma com múltiplos providers no mesmo monorepo é suportado, mas exige atenção a diferenças de dialeto ao escrever migrations.
- Estratégia de aplicar migrations em centenas de arquivos SQLite espalhados ainda precisa ser desenhada (ver ADR 0001, consequências).
