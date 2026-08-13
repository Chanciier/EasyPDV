# Arquitetura Electron — EasyPDV

`apps/electron` — shell desktop que empacota `pdv-frontend` (export estático) + `pdv-backend` (processo local) num único instalador Windows.

## Processos

- **Main** (`src/main/`) — único com acesso a hardware (impressora, gaveta, leitor), gerencia janela, auto-update, provisionamento do terminal, e inicia o processo local do `pdv-backend`.
- **Renderer** — o build estático de `pdv-frontend`, `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- **Preload** (`src/preload/`) — `contextBridge` expondo só funções nomeadas (`window.easypdv.*`), nunca `ipcRenderer` cru.

## IPC

Canais nomeados por convenção `domínio:ação` (`printer:print`, `drawer:open`, `scanner:onScan`, `app:checkForUpdate`), payloads tipados via `packages/shared-types`. Nenhum canal genérico de "invoke qualquer coisa".

## Auto Update

`electron-updater`, canal estável separado de beta. Checagem no boot e periódica. **Aplicação condicionada a não existir `CashSession` aberta no terminal** — nunca atualiza no meio de uma venda.

## Provisionamento de terminal

No primeiro boot sem terminal registrado, o app entra em modo de ativação: código gerado por um Administrador (via API do Intermediador) troca por uma identidade de terminal persistida localmente (`safeStorage` do Electron).

## Hardware

Impressora, gaveta e leitor ficam atrás de uma interface interna comum no Main Process (`PrinterDriver` etc.) — trocar de fabricante não deve tocar Renderer nem Preload. Impressora de referência: Elgin i9/L42 Pro Full (pode mudar). Leitor de código de barras USB-teclado é capturado direto pelo Renderer, sem IPC.

## Segurança

`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, módulo `remote` desabilitado, whitelist explícita de canais IPC, CSP estrita na `BrowserWindow`.
