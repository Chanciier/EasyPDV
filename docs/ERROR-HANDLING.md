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

Concorrência na baixa de estoque (dois caixas confirmando o último item ao mesmo tempo) precisa de lock otimista/pessimista explícito — ver Sprint 5 em [ROADMAP.md](./ROADMAP.md).
