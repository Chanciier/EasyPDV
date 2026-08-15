# Modelo de Dados — EasyPDV

Duas bases de dados distintas, sem se misturar. Ver [ARCHITECTURE.md](./ARCHITECTURE.md) para a topologia completa.

## PDV local (SQLite, `apps/pdv-backend`)

| Entidade | Finalidade | Observações |
|---|---|---|
| StoreIdentity | Identifica a loja/organização deste install | **Implementado na Sprint 10.** Uma linha só (um `.exe` = um terminal = uma loja), criada em `POST /provisioning/activate`. Guarda `organizationId`/`storeId`/`storeName`/`terminalId` (espelhados do Intermediador) + `apiKey` em texto puro — é o que `HttpSyncGateway` anexa em cada `POST /sync`. Substitui o `Terminal` local (lastSeenAt/appVersion/status) do desenho original do Sprint 0: o Intermediador já rastreia isso centralmente (`Terminal.lastSeenAt`), duplicar localmente não agregava nada e o PDV local nem sempre tem rede pra manter isso atualizado |
| User | Login e papel do operador nesta loja | `role` direto no usuário (não uma tabela separada) — como o banco local já representa uma única loja, escopar por `storeId` como no Intermediador seria redundante. Papéis: operador, supervisor, gerente, administrador, proprietario, auditor, tecnico |
| AuthSession | Sessão de refresh token | Rotacionada a cada uso; `refreshTokenHash` nunca guarda o token em texto puro |
| Product / Category / Barcode | Catálogo | Um produto pode ter N códigos de barras |
| PriceList / PriceListItem | Preço vigente | Preço nunca é campo direto no produto |
| Warehouse / StockItem / StockMovement | Estoque | StockMovement é o ledger append-only (fonte da verdade); StockItem é projeção. `StockMovement.quantity` é sempre o delta assinado já aplicado ao saldo (negativo = saída) — `type` só documenta o motivo, nunca determina o sinal |
| CashRegister / CashSession / CashMovement | Caixa | Sessão é o vínculo temporário operador↔caixa. `expectedAmount` = abertura + suprimento - sangria + ajuste + vendas em dinheiro confirmadas na sessão (a soma de vendas só foi implementada na Sprint 9, ao construir a tela real de Caixa — bug pré-existente desde a Sprint 5, ver docs/CHANGELOG.md) |
| Sale / SaleItem / Payment | Venda | Sale.status: draft → confirmed \| cancelled. **Implementado desde a Sprint 5**: confirm() exige itens + pagamentos aprovados >= totalAmount, e debita o estoque de cada item na mesma transação Prisma (`Sale.update` + `StockMovement.create` tipo "venda" + `StockItem.upsert` com `decrement` atômico). Payment.status entra direto "aprovado" em V1 (sem TEF/gateway real — cartão é declarado manualmente pelo operador, ver ROADMAP.md) |
| FiscalDocument | Comprovante/NFC-e da venda | type: nfce \| comprovante_nao_fiscal |
| Customer | Cliente da loja | |
| AuditLog | Trilha imutável de ações sensíveis | |
| Setting | Configuração key-value | |
| SyncOutbox | Fila local de sincronização pendente com o Intermediador | **Implementado na Sprint 6.** Transactional outbox — gravado na mesma transação que `SaleConfirmed` (dentro de `PrismaSaleRepository.confirm()`, mesma exceção pragmática documentada para o débito de estoque). `SyncOutboxWorker` varre por status=pending a cada 15s e faz `POST /sync` no Intermediador; "synced" aqui só significa "entregue à fila do Intermediador", não que o Bling já processou. Teto de 5 tentativas antes de virar "failed" (SLA de retry configurável continua em aberto, ver docs/ERROR-HANDLING.md). **Sprint 8**: `POST /sync/outbox/:id/retry` reseta uma entrada "failed" de volta pra "pending" (UPDATE condicional atômico, evita corrida em duplo-retry) |

## Intermediador (PostgreSQL, `apps/intermediador`)

| Entidade | Finalidade | Observações |
|---|---|---|
| Organization / Store | Espelho central de todas as lojas de todos os clientes | Multi-tenant real — isolar por `organizationId` em toda query |
| ActivationCode | Código de uso único gerado por um Administrador pra ativar um terminal novo | **Implementado na Sprint 10.** `POST /organizations/:id/activation-codes` cria a Store (se `storeName`) ou reusa uma existente (`storeId`) e gera o código — 8 caracteres, alfabeto sem 0/O/1/I/L, expira em 30min, uso único (`usedAt`, `UPDATE` condicional evita corrida em duas ativações simultâneas com o mesmo código) |
| Terminal | Instalação do Electron ativada contra uma Store | **Implementado na Sprint 10.** `apiKeyHash` é SHA-256 (não bcrypt — a apiKey já nasce alta-entropia, o que importa é lookup rápido por índice único, não resistência a força bruta de senha humana). A apiKey em texto puro só existe uma vez, na resposta de `POST /terminals/activate` — o PDV local que a recebe persiste no seu `StoreIdentity` (SQLite) local |
| ErpIntegration | Credenciais OAuth do Bling por organização | **Implementado na Sprint 7.** accessToken/refreshToken/expiresAt — o Bling rotaciona o refresh_token a cada uso, os dois tokens são sempre sobrescritos juntos (`BlingTokenProviderService`). `@@unique([organizationId, provider])` |
| ErpSyncMapping | Cache de ID externo (Bling) por entidade local | **Implementado na Sprint 7.** localEntityType: "product" (SKU→id do produto), "contact" ("Consumidor Final"→id), "sale" (Sale.id local→id do pedido de venda criado). Fica fora dos agregados de domínio de propósito — é o que impede o Bling de contaminar a arquitetura |
| SyncJob | Job de sincronização (outbox durável) | status: pending → processing → synced \| failed. `@@unique([entityType, entityId])` garante idempotência — reenvio do mesmo entityId (timeout ambíguo do lado do PDV local) não duplica o job. Enfileirado no BullMQ (fila "sync", 5 tentativas com backoff exponencial); processado pelo `BlingSyncTargetAdapter` real desde a Sprint 7 (antes, `NoopSyncTargetAdapter` só provava a fila — continua no código como dublê de teste). **Sprint 8**: `POST /sync/jobs/:id/retry` reseta e reenfileira um job "failed" (UPDATE condicional atômico); `SyncJobReconciliationWorker` varre a cada 2min por jobs travados em "processing" há mais de 5min (worker/Redis perdeu o job) e marca "failed" pra reconciliação manual |

## Evento central

`SaleConfirmed` é o gatilho para: débito de estoque (mesma transação local), auditoria (mesma transação local, ainda não implementada), impressão do comprovante não-fiscal (imediato, ainda não implementada), e gravação no SyncOutbox local (Sprint 6) → Intermediador → **Bling (Adapter real desde a Sprint 7)** → emissão fiscal (ainda não implementada).

Ver [EVENTS.md](./EVENTS.md) para o catálogo completo de eventos.
