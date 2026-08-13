# Versionamento — EasyPDV

- **API**: prefixo `/v1`. Mudanças aditivas não exigem nova versão; mudanças que quebram contrato exigem `/v2` coexistindo durante uma janela de transição.
- **Banco (migrations)**: sequenciais e imutáveis após aplicadas em produção — nunca editar uma já aplicada. No Intermediador (Postgres central) isso é simples; no PDV local (SQLite distribuído por loja) ainda precisa de estratégia própria para aplicar migrations em instalações offline/desatualizadas — ver risco aberto em [ARCHITECTURE.md](./ARCHITECTURE.md).
- **Aplicação (backend)**: semver independente da versão pública da API.
- **Electron/auto-update**: canal estável separado de beta; nunca atualiza com `CashSession` aberta; app verifica versão mínima de API suportada no boot.
- **Compatibilidade**: o Intermediador tolera terminais rodando uma versão N-1 por um período — nem toda loja atualiza no mesmo dia.
