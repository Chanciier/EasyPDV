# Tratamento de Erros — EasyPDV

| Cenário | Comportamento | Recuperação |
|---|---|---|
| Intermediador/Bling indisponível | Venda segue normal, nunca bloqueia | `SyncOutboxWorker` local retenta a cada 15s (teto de 5 tentativas); no Intermediador, BullMQ retenta o job (5 tentativas, backoff exponencial); após esgotar, Central de Erros de Sincronização (Sprint 8) |
| Redis indisponível (Intermediador) | Sync fica represada, venda local não é afetada | **Gap ainda aberto (Sprint 6):** se o Redis perder o job em fila (sem persistência/eviction) enquanto o `SyncJob` no Postgres ficou "pending"/"processing", não há hoje uma varredura periódica que reenfileira `SyncJob`s órfãos — só o `POST /sync` original (ou um reenvio do outbox local) cria/reaproveita o job. Essa varredura de reconciliação é escopo da Central de Erros de Sincronização (Sprint 8); até lá, `SyncJob` no Postgres é a fonte de verdade do *estado*, mas não se auto-recupera de perda do Redis |
| Produto sem estoque | Alerta visual, mas permite prosseguir | Relatório de divergência para ajuste manual |
| Pagamento recusado | Registrado como `recusado`, venda aguardando | Operador tenta outra forma — fluxo normal |
| Venda duplicada | Prevenida por chave de idempotência gerada no frontend | Reenvio com a mesma chave retorna o resultado já processado |
| Token expirado | 401 → renovação automática via refresh token; falha total força login | Carrinho em memória não pode ser perdido durante a reautenticação |
| Timeout | Não significa "falhou", significa "incerto" — resolvido pela idempotência | Reenviar é seguro |
| Conflito de sincronização (preço divergente Bling×local) | Nunca sobrescreve silenciosamente — gera item de revisão manual | Central de Erros de Sincronização |
| Falha de conexão PDV local ↔ Intermediador | Só afeta sincronização, nunca a venda em si | Fila local aguarda reconexão |

**Resolvido na Sprint 5:** concorrência na baixa de estoque (dois caixas confirmando venda do mesmo produto ao mesmo tempo) foi resolvida sem lock explícito — `PrismaSaleRepository.confirm()` usa `StockItem.update({ quantity: { decrement: n } })`, que o Prisma traduz num `UPDATE ... SET quantity = quantity - n` atômico no SQL, e a serialização de escritas do próprio SQLite garante que as duas transações não se intercalem. Validado empiricamente disparando duas confirmações simultâneas do mesmo produto (5 unidades cada, estoque inicial 60): resultado final 50 (60-5-5), com dois `StockMovement` distintos — nenhuma escrita perdida. Ver [DATABASE.md](./DATABASE.md).

**Gap conhecido desde a Sprint 6:** `POST /sync` (Intermediador) não tem autenticação nenhuma — qualquer requisição consegue criar/consultar `SyncJob`s. Aceitável só porque provisionamento de terminal e autenticação PDV local ↔ Intermediador ainda não existem (Sprint 10 / risco aberto — ver `Claude/Projetos/EasyPDV/Decisões e Riscos Abertos.md` no cofre Obsidian); precisa ser fechado antes de qualquer deploy real no Railway.
