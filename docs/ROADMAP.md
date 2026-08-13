# Roadmap — EasyPDV

Sprints em ordem de implementação até a V1 comercial. Detalhe de objetivo/entregáveis/critérios de aceite/dependências/riscos de cada uma foi definido durante o planejamento arquitetural (ver cofre Obsidian, `Claude/Projetos/EasyPDV/Roadmap e Escopo.md`).

| # | Sprint | Foco |
|---|---|---|
| 0 | Fundação técnica | Monorepo, CI, Docker Compose, schema inicial — **este sprint** |
| 1 | Identidade e Acesso | Login, RBAC por loja |
| 2 | Catálogo | Produtos, categorias, código de barras, tabela de preço |
| 3 | Estoque | Depósitos, saldo, movimentação |
| 4 | Caixa e Venda (núcleo) | Abrir/fechar caixa, itens de venda |
| 5 | Pagamentos + Confirmação | Núcleo transacional local completo + lock de concorrência no estoque |
| 6 | Outbox, Fila e Workers | Infraestrutura de sincronização (sem Adapter ainda) |
| 7 | Adapter Bling | Sincronização real ponta a ponta |
| 8 | Central de Erros de Sincronização | Reconciliação manual |
| 9 | Frontend: migração do mock | `pos-provider.tsx` → TanStack Query + Zustand consumindo API real |
| 10 | Electron: empacotamento | Instalador, provisionamento de terminal, auto-update |
| 11 | Hardware | Impressora, gaveta, leitor |
| 12 | Fiscal | NFC-e via Bling + fallback de comprovante não-fiscal |
| 13 | Auditoria, Relatórios e Realtime | |
| 14 | Hardening e homologação | Loja piloto |
| 15 | Lançamento V1 comercial | |

## V1 obrigatório
Identidade/RBAC básico, PDV/Venda, Caixa, Pagamentos, Descontos, Comprovante, Produtos/Estoque básico, Clientes, Adapter Bling, Central de Erros de Sync, Auditoria, Relatórios básicos, Hardware essencial, Auto-update.

## V2 / Futuro
Ver `Claude/Projetos/EasyPDV/Roadmap e Escopo.md` no cofre Obsidian para a lista completa.
