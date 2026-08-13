# EasyPDV

Sistema de PDV para Windows, com arquitetura pensada para ser vendido como produto comercial. Bling é integrado só como um Adapter — nunca contamina o domínio.

## Estrutura

```
apps/
  pdv-frontend/   Next.js (UI, reaproveitado de um protótipo existente)
  pdv-backend/    Backend local — roda dentro do .exe da loja (NestJS + SQLite)
  electron/       Shell desktop que empacota frontend + backend local
  intermediador/  Serviço no Railway que fala com o Bling (NestJS + PostgreSQL)
packages/         Código compartilhado (tipos, validação, eventos, ui, tsconfig)
docs/             Documentação de arquitetura — comece por docs/ARCHITECTURE.md
```

## Setup local

```bash
pnpm install
cp apps/pdv-backend/.env.example apps/pdv-backend/.env
cp apps/intermediador/.env.example apps/intermediador/.env
docker compose -f docker/docker-compose.yml up -d   # Postgres + Redis, só para o intermediador
pnpm dev
```

Ver [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) para a visão completa e [docs/ROADMAP.md](./docs/ROADMAP.md) para o plano de sprints.
