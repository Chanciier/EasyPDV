# ADR 0001 — Topologia: PDV local + Intermediador separados

## Status
Aceita (2026-08-13)

## Contexto
O PDV precisa nunca depender do Bling nem de internet para concluir uma venda, mas também precisa sincronizar com o Bling e, no futuro, ser vendido como produto para centenas de empresas sem exigir TI própria em cada loja.

## Decisão
Dois deployáveis: **PDV local** (dentro do `.exe` da loja, NestJS + SQLite) e **Intermediador** (Railway, NestJS + PostgreSQL + Redis/BullMQ). O PDV local nunca fala com o Bling diretamente — só com o Intermediador.

## Consequências
- Banco local precisou mudar de PostgreSQL (stack "oficial" original) para SQLite — inviável empacotar/manter um processo Postgres em centenas de lojas sem TI própria (ver ADR 0002).
- Migração de schema em SQLite distribuído por loja é um problema ainda não resolvido (diferente de migrar um único Postgres central).
- Emissão fiscal, por depender do Bling via Intermediador, não pode ser síncrona/imediata — resolvido com fallback de comprovante não-fiscal impresso local (ver ADR 0003).
