# Módulos do Backend — EasyPDV

Cada módulo só acessa outro via leitura explícita (chamada síncrona ao *application service* público) ou reação a evento — nunca importando modelo de dados interno alheio.

## PDV local (`apps/pdv-backend`)

| Módulo | Responsabilidade | Produz | Consome |
|---|---|---|---|
| Identity & Access | Auth, papéis por loja | UserLoggedIn, UserCreated, RoleAssigned | — |
| Catalog | Produtos, categorias, tabela de preço | ProductCreated/Updated, PriceChanged | — |
| Inventory | Depósitos, saldo, movimentação | StockAdjusted, StockDebited | SaleConfirmed, SaleCancelled |
| Customers | Cadastro de clientes | CustomerCreated/Updated | — |
| Sales | Caixa, itens, pagamentos | CashOpened/Closed, SaleConfirmed, PaymentRegistered | — |
| Fiscal | Comprovante local + solicitação de NFC-e | FiscalDocumentRequested | SaleConfirmed |
| Sync (outbox) | Enfileira sincronização com o Intermediador | SyncRequested | SaleConfirmed, ProductUpdated, StockAdjusted |
| Audit | Trilha imutável | — | todos os eventos sensíveis |
| Settings | Config key-value | SettingChanged | — |
| Realtime Gateway | WebSocket para o frontend | — | todos os eventos relevantes p/ UI |

## Intermediador (`apps/intermediador`)

| Módulo | Responsabilidade | Produz | Consome |
|---|---|---|---|
| ERP Integration | Adapter Bling, ErpSyncMapping, SyncJob, fila BullMQ | SyncSucceeded, SyncFailed | SyncRequested (via API do PDV local) |
| Organizations | Master data de organizações/lojas | — | — |

Ver [BACKEND.md](./BACKEND.md) para como esses módulos se comunicam dentro do NestJS.
