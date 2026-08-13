# Modelo de Dados — EasyPDV

Duas bases de dados distintas, sem se misturar. Ver [ARCHITECTURE.md](./ARCHITECTURE.md) para a topologia completa.

## PDV local (SQLite, `apps/pdv-backend`)

| Entidade | Finalidade | Observações |
|---|---|---|
| StoreIdentity | Identifica a loja/organização deste install | Uma linha só, criada no provisionamento do terminal |
| Terminal | Instalação registrada do Electron | lastSeenAt, appVersion, status |
| User / UserStoreRole | Login e papel do operador nesta loja | Papéis: operador, supervisor, gerente, administrador, proprietario, auditor, tecnico |
| Product / Category / Barcode | Catálogo | Um produto pode ter N códigos de barras |
| PriceList / PriceListItem | Preço vigente | Preço nunca é campo direto no produto |
| Warehouse / StockItem / StockMovement | Estoque | StockMovement é o ledger append-only (fonte da verdade); StockItem é projeção |
| CashRegister / CashSession / CashMovement | Caixa | Sessão é o vínculo temporário operador↔caixa |
| Sale / SaleItem / Payment | Venda | Sale.status: draft → confirmed / cancelled |
| FiscalDocument | Comprovante/NFC-e da venda | type: nfce \| comprovante_nao_fiscal |
| Customer | Cliente da loja | |
| AuditLog | Trilha imutável de ações sensíveis | |
| Setting | Configuração key-value | |
| SyncOutbox | Fila local de sincronização pendente com o Intermediador | Transactional outbox — grava na mesma transação que `SaleConfirmed` |

## Intermediador (PostgreSQL, `apps/intermediador`)

| Entidade | Finalidade | Observações |
|---|---|---|
| Organization / Store | Espelho central de todas as lojas de todos os clientes | Multi-tenant real — isolar por `organizationId` em toda query |
| ErpIntegration | Config de qual ERP está conectado por organização | provider: bling \| tiny \| omie \| conta_azul \| proprio (só bling na V1) |
| ErpSyncMapping | Mapeamento de ID externo (Bling) por entidade local | **Fica fora dos agregados de domínio** — é o que impede o Bling de contaminar a arquitetura |
| SyncJob | Job de sincronização (outbox durável) | status: pending → processing → synced \| failed |

## Evento central

`SaleConfirmed` é o gatilho para: débito de estoque (mesma transação local), auditoria (mesma transação local), impressão do comprovante não-fiscal (imediato), e gravação no SyncOutbox local (assíncrono → Intermediador → Bling → emissão fiscal).

Ver [EVENTS.md](./EVENTS.md) para o catálogo completo de eventos.
