# API REST — EasyPDV

## PDV local (`apps/pdv-backend`, porta 4001)

```
/health
POST   /auth/login     { email, password } → { user, tokens }
POST   /auth/refresh   { refreshToken } → tokens (rotaciona — o antigo é revogado)
POST   /auth/logout    { refreshToken } → revoga a sessão
GET    /auth/me        (Bearer token) → usuário atual
POST   /users          (Bearer + role administrador) → cria usuário
PATCH  /users/:id/role (Bearer + role administrador) → troca o papel
/products         CRUD + /search?barcode=
/categories
/price-lists      + /items
/warehouses
/stock            movements, adjustments
/customers        + /:id/sales
/cash             sessions (open/close/current), movements
/sales            CRUD de itens, /confirm, /cancel
/payments         (sub-rota de /sales/:id/payments)
/fiscal           documents/:saleId, reissue, cancel
/reports          sales, cash-sessions, stock, dashboard
/settings
/audit-logs
```

## Intermediador (`apps/intermediador`, porta 4002)

```
/health
/organizations    provisionamento de organização/loja
/terminals        registro/ativação de terminal
/sync             POST recebido do PDV local (SyncRequested), status de jobs
/integrations     conexão com Bling, status, retry de sync-job
```

Schemas de request/response ficam em `packages/shared-validation` (Zod) e tipos em `packages/shared-types` — a mesma definição vale para o backend validar e o frontend tipar o client HTTP.

Endpoints detalhados por módulo entram conforme cada Sprint implementa o módulo correspondente — ver [ROADMAP.md](./ROADMAP.md).
