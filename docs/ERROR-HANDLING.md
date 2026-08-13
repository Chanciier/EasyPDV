# Tratamento de Erros — EasyPDV

| Cenário | Comportamento | Recuperação |
|---|---|---|
| Intermediador/Bling indisponível | Venda segue normal, nunca bloqueia | Retry com backoff; após esgotar, Central de Erros de Sincronização |
| Redis indisponível (Intermediador) | Sync fica represada, venda local não é afetada | Varredura periódica reenfileira `SyncJob`s pendentes — por isso `SyncJob`/outbox no Postgres é a fonte de verdade, não o Redis |
| Produto sem estoque | Alerta visual, mas permite prosseguir | Relatório de divergência para ajuste manual |
| Pagamento recusado | Registrado como `recusado`, venda aguardando | Operador tenta outra forma — fluxo normal |
| Venda duplicada | Prevenida por chave de idempotência gerada no frontend | Reenvio com a mesma chave retorna o resultado já processado |
| Token expirado | 401 → renovação automática via refresh token; falha total força login | Carrinho em memória não pode ser perdido durante a reautenticação |
| Timeout | Não significa "falhou", significa "incerto" — resolvido pela idempotência | Reenviar é seguro |
| Conflito de sincronização (preço divergente Bling×local) | Nunca sobrescreve silenciosamente — gera item de revisão manual | Central de Erros de Sincronização |
| Falha de conexão PDV local ↔ Intermediador | Só afeta sincronização, nunca a venda em si | Fila local aguarda reconexão |

**Resolvido na Sprint 5:** concorrência na baixa de estoque (dois caixas confirmando venda do mesmo produto ao mesmo tempo) foi resolvida sem lock explícito — `PrismaSaleRepository.confirm()` usa `StockItem.update({ quantity: { decrement: n } })`, que o Prisma traduz num `UPDATE ... SET quantity = quantity - n` atômico no SQL, e a serialização de escritas do próprio SQLite garante que as duas transações não se intercalem. Validado empiricamente disparando duas confirmações simultâneas do mesmo produto (5 unidades cada, estoque inicial 60): resultado final 50 (60-5-5), com dois `StockMovement` distintos — nenhuma escrita perdida. Ver [DATABASE.md](./DATABASE.md).
