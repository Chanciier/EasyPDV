# Modelo de Dados — EasyPDV

Duas bases de dados distintas, sem se misturar. Ver [ARCHITECTURE.md](./ARCHITECTURE.md) para a topologia completa.

## PDV local (SQLite, `apps/pdv-backend`)

| Entidade | Finalidade | Observações |
|---|---|---|
| StoreIdentity | Identifica a loja/organização deste install | Uma linha só, criada no provisionamento do terminal |
| Terminal | Instalação registrada do Electron | lastSeenAt, appVersion, status |
| User | Login e papel do operador nesta loja | `role` direto no usuário (não uma tabela separada) — como o banco local já representa uma única loja, escopar por `storeId` como no Intermediador seria redundante. Papéis: operador, supervisor, gerente, administrador, proprietario, auditor, tecnico |
| AuthSession | Sessão de refresh token | Rotacionada a cada uso; `refreshTokenHash` nunca guarda o token em texto puro |
| Product / Category / Barcode | Catálogo | Um produto pode ter N códigos de barras |
| PriceList / PriceListItem | Preço vigente | Preço nunca é campo direto no produto |
| Warehouse / StockItem / StockMovement | Estoque | StockMovement é o ledger append-only (fonte da verdade); StockItem é projeção. `StockMovement.quantity` é sempre o delta assinado já aplicado ao saldo (negativo = saída) — `type` só documenta o motivo, nunca determina o sinal |
| CashRegister / CashSession / CashMovement | Caixa | Sessão é o vínculo temporário operador↔caixa. `expectedAmount` = abertura + suprimento - sangria + ajuste (soma de vendas em dinheiro entra na Sprint 5, junto com Payment) |
| Sale / SaleItem / Payment | Venda | Sale.status: draft → confirmed \| cancelled. **Implementado desde a Sprint 5**: confirm() exige itens + pagamentos aprovados >= totalAmount, e debita o estoque de cada item na mesma transação Prisma (`Sale.update` + `StockMovement.create` tipo "venda" + `StockItem.upsert` com `decrement` atômico). Payment.status entra direto "aprovado" em V1 (sem TEF/gateway real — cartão é declarado manualmente pelo operador, ver ROADMAP.md) |
| FiscalDocument | Comprovante/NFC-e da venda | type: nfce \| comprovante_nao_fiscal |
| Customer | Cliente da loja | |
| AuditLog | Trilha imutável de ações sensíveis | |
| Setting | Configuração key-value | |
| SyncOutbox | Fila local de sincronização pendente com o Intermediador | **Implementado na Sprint 6.** Transactional outbox — gravado na mesma transação que `SaleConfirmed` (dentro de `PrismaSaleRepository.confirm()`, mesma exceção pragmática documentada para o débito de estoque). `SyncOutboxWorker` varre por status=pending a cada 15s e faz `POST /sync` no Intermediador; "synced" aqui só significa "entregue à fila do Intermediador", não que o Bling já processou. Teto de 5 tentativas antes de virar "failed" (SLA de retry configurável continua em aberto, ver docs/ERROR-HANDLING.md) |

## Intermediador (PostgreSQL, `apps/intermediador`)

| Entidade | Finalidade | Observações |
|---|---|---|
| Organization / Store | Espelho central de todas as lojas de todos os clientes | Multi-tenant real — isolar por `organizationId` em toda query |
| ErpIntegration | Credenciais OAuth do Bling por organização | **Implementado na Sprint 7.** accessToken/refreshToken/expiresAt — o Bling rotaciona o refresh_token a cada uso, os dois tokens são sempre sobrescritos juntos (`BlingTokenProviderService`). `@@unique([organizationId, provider])` |
| ErpSyncMapping | Cache de ID externo (Bling) por entidade local | **Implementado na Sprint 7.** localEntityType: "product" (SKU→id do produto), "contact" ("Consumidor Final"→id), "sale" (Sale.id local→id do pedido de venda criado). Fica fora dos agregados de domínio de propósito — é o que impede o Bling de contaminar a arquitetura |
| SyncJob | Job de sincronização (outbox durável) | status: pending → processing → synced \| failed. `@@unique([entityType, entityId])` garante idempotência — reenvio do mesmo entityId (timeout ambíguo do lado do PDV local) não duplica o job. Enfileirado no BullMQ (fila "sync", 5 tentativas com backoff exponencial); processado pelo `BlingSyncTargetAdapter` real desde a Sprint 7 (antes, `NoopSyncTargetAdapter` só provava a fila — continua no código como dublê de teste) |

## Evento central

`SaleConfirmed` é o gatilho para: débito de estoque (mesma transação local), auditoria (mesma transação local, ainda não implementada), impressão do comprovante não-fiscal (imediato, ainda não implementada), e gravação no SyncOutbox local (Sprint 6) → Intermediador → **Bling (Adapter real desde a Sprint 7)** → emissão fiscal (ainda não implementada).

Ver [EVENTS.md](./EVENTS.md) para o catálogo completo de eventos.
