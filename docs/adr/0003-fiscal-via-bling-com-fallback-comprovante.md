# ADR 0003 — Fiscal via Bling, com fallback de comprovante não-fiscal

## Status
Aceita (2026-08-13)

## Contexto
A emissão fiscal (NFC-e) precisava de um provedor. Integração direta com a SEFAZ é cara e complexa (homologação por UF); provedores terceirizados (Focus NFe, NFE.io) são uma opção comum no mercado. Como o Bling já é o ERP integrado (ADR 0001) e tem emissão de NFC-e própria, usar diretamente o Bling evita uma segunda integração fiscal.

## Decisão
Emissão fiscal obrigatoriamente via **Bling**, através do Intermediador — não SEFAZ direto, não provedor terceirizado. Como isso está sujeito à mesma latência/eventual-consistência da sincronização com o Bling, toda venda confirmada também imprime um **comprovante não-fiscal localmente, na hora** (sempre funciona, independe do Bling). O documento fiscal de verdade chega em seguida, de forma assíncrona.

## Consequências
- Fiscal fica fora do caminho crítico da venda — reforça o princípio "venda nunca depende do Bling".
- Reduz o Sprint 12 a "integração com o Bling para NFC-e" em vez de uma integração fiscal própria — mais simples, mas com fiscal 100% dependente da disponibilidade do Bling a médio prazo.
- Fiscal pode esperar para depois da V1 — o comprovante não-fiscal já cobre a necessidade imediata do balcão.
