# Eventos Internos — EasyPDV

Nomes definidos em `packages/shared-events`. Sempre no passado (algo que já aconteceu).

| Evento | Quando dispara |
|---|---|
| UserLoggedIn / UserLoggedOut | Login/logout do operador no terminal |
| UserCreated / RoleAssigned | Gestão de usuários |
| ProductCreated / ProductUpdated | Alteração de catálogo |
| PriceChanged | Alteração de PriceListItem |
| StockAdjusted | Ajuste manual de estoque |
| StockDebited | Baixa efetiva após `SaleConfirmed` |
| CashOpened / CashClosed | Abertura/fechamento de sessão de caixa |
| CashMovementRegistered | Sangria/suprimento/ajuste |
| SaleStarted | Rascunho de venda criado |
| SaleItemAdded | Item adicionado à venda |
| PaymentRegistered | Pagamento registrado (aprovado ou recusado) |
| **SaleConfirmed** | **Evento central** — soma dos pagamentos aprovados cobre o total. Gatilho de: débito de estoque, auditoria, comprovante local, sync outbox |
| SaleCancelled | Venda cancelada antes de confirmar |
| FiscalDocumentRequested / Issued / Failed | Ciclo de emissão do NFC-e via Bling |
| SyncRequested | Gravado no outbox local, a caminho do Intermediador |
| SyncSucceeded / SyncFailed | Resultado da sincronização no Intermediador |

Ver [DATABASE.md](./DATABASE.md) para as entidades envolvidas e a distinção entre eventos de domínio (in-process) e de integração (fila).
