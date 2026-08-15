# Arquitetura Electron — EasyPDV

`apps/electron` — shell desktop que empacota `pdv-frontend` (export estático) + `pdv-backend` (processo local) num único instalador Windows. Implementado na Sprint 10.

## Processos

- **Main** (`src/main/index.ts`) — único com acesso a hardware (impressora, gaveta, leitor, Sprint 11), gerencia a janela, spawna o `pdv-backend` como processo filho, decide entre a UI de ativação e o app real, e roda o auto-update.
- **Renderer** — o build estático de `pdv-frontend` (uma vez ativado) ou `resources/activation.html` (antes da ativação), `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- **Preload** (`src/preload/index.ts`) — `contextBridge` expondo só funções nomeadas (`window.easypdv.*`), nunca `ipcRenderer` cru. Se aplica às duas páginas (mesma `BrowserWindow`).

## Como o pdv-backend é iniciado

`startBackend()` spawna `dist/main.js` do pdv-backend como processo filho via `spawn(process.execPath, [entry], { env: { ELECTRON_RUN_AS_NODE: "1", ... } })` — `ELECTRON_RUN_AS_NODE` faz o próprio binário do Electron rodar como um Node.js puro, então **não precisa de uma instalação separada de Node no PC do cliente**. `DATABASE_URL` é montada em runtime apontando pra `app.getPath("userData")/easypdv.db` (SQLite por instalação, fora da pasta somente-leitura do instalador) e injetada explicitamente no `env` do processo filho — nunca depende de um `.env` empacotado. `JWT_SECRET` (`IdentityModule` exige via `getOrThrow`) é gerada uma vez por instalação (`crypto.randomBytes(48)`) e persistida em `app.getPath("userData")/jwt-secret`, reaproveitada entre boots — nunca hardcoded no código-fonte (senão toda instalação do EasyPDV compartilharia a mesma chave de assinatura de token).

O próprio `pdv-backend` (`src/main.ts`, `runMigrations()`) roda `prisma migrate deploy` contra esse `DATABASE_URL` antes de escutar a porta — idempotente, roda em todo boot. É assim que cada instalação nova se automigra sozinha no primeiro boot (ou quando uma versão nova do app traz uma migration nova), sem o instalador precisar rodar `prisma migrate dev` manualmente em cada loja. Logo em seguida, `ensureAdminUser()` garante pelo menos um Administrador (`count()>0` sai sem fazer nada — idempotente, mesma lógica de `prisma/seed.ts`, mas só a parte do admin: `prisma db seed` inteiro é fixture de dev, catálogo/depósito de exemplo não devem ir pra produção). Sem isso, um install novo não teria usuário nenhum e ninguém conseguiria logar. `createWindow()` só acontece depois de `waitForHealth()` confirmar `GET /health` respondendo.

**Risco aberto conhecido**: o admin nasce com `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` (default `admin@easypdv.local`/`troque-esta-senha`) — mesmo placeholder do seed de dev, sem troca obrigatória no primeiro login. Toda loja nova nasce com a mesma senha conhecida publicamente até esse fluxo ser construído (ver Decisões e Riscos Abertos no cofre Obsidian — risco #8, não bloqueia dev/teste mas bloqueia venda real).

## Provisionamento de terminal

No boot, o Main consulta `GET /provisioning/status` no backend local recém-subido:
- **`activated: false`** → carrega `resources/activation.html` (página HTML standalone, vanilla JS — não faz parte do build do Next.js). O operador digita o código de ativação gerado por um Administrador (`POST /organizations/:id/activation-codes` no Intermediador); a página chama `POST /provisioning/activate` no backend local, que troca o código por uma identidade de terminal + apiKey no Intermediador (`POST /terminals/activate`) e persiste tudo em `StoreIdentity` (SQLite, uma linha só). Ver docs/DATABASE.md.
- **`activated: true`** → carrega o export estático de `pdv-frontend` direto.

Depois de ativar, a página chama `window.easypdv.activationCompleted()` (preload → IPC `activation:completed`) — é o Main, não a própria página, quem decide trocar pra janela do app real (`mainWindow.loadFile(resolveFrontendIndex())`); a página de ativação não tem esse poder sozinha (contextIsolation).

A apiKey retornada por `POST /terminals/activate` é o que `HttpSyncGateway` (módulo Sync do pdv-backend) anexa em todo `POST /sync` no Intermediador daqui pra frente — fecha o risco #6 documentado em Decisões e Riscos Abertos (autenticação PDV local ↔ Intermediador inexistente).

## Empacotamento

`pnpm --filter @easypdv/electron prepackage` (`scripts/prepare-resources.js`) roda antes de `electron-builder`:
1. `pnpm --filter @easypdv/pdv-backend build`.
2. `pnpm --filter @easypdv/pdv-backend deploy --prod --legacy resources-build/pdv-backend` — monta um `node_modules` **autocontido, sem symlink do pnpm store**. Necessário porque o processo filho que o Electron spawna resolve módulo Node padrão, não entende o link simbólico do monorepo (`pnpm deploy` é a ferramenta feita pra exatamente isso — "prepare a package for production"). `--legacy` porque este workspace não tem `inject-workspace-packages=true`.
3. `prisma generate` de novo dentro do bundle deployado — `pnpm deploy` não roda esse postinstall sozinho, e o engine nativo da plataforma precisa existir ali.
4. Remove `prisma/dev.db` e `.env` do bundle deployado — artefato de dev que não deve ir pro instalador.
5. Copia o export estático de `pdv-frontend` (`out/`) pra `resources-build/pdv-frontend`.

`electron-builder` (`pnpm --filter @easypdv/electron package`) usa `extraResources` pra copiar `resources-build/pdv-backend` → `resources/pdv-backend` e `resources-build/pdv-frontend` → `resources/pdv-frontend` no app empacotado (fora do `app.asar` — precisam existir como arquivos reais no disco pro Node spawnar/ler, `asar` tem limitações com binários nativos e child_process). `resolveBackendEntry()`/`resolveFrontendIndex()` no Main distinguem dev (`../../../pdv-backend`, irmão de `apps/electron`) de empacotado (`process.resourcesPath`).

**Testado de verdade nesta sprint, incluindo o `.exe` empacotado de verdade** (não só `pnpm start` em dev): banco SQLite novo criado em `app.getPath("userData")`, as 7 migrations aplicadas sozinhas do zero, Nest subindo, `/health` e `/provisioning/status` respondendo pro próprio Electron, `POST /auth/login` com o admin auto-criado devolvendo um token JWT real — em dev E rodando `EasyPDV.exe` do instalador gerado (userData limpo entre tentativas pra simular instalação genuinamente nova). Dois bugs reais só apareceram nesse teste do pacote final (ambos silenciosos em dev, mascarados pelo `.env` local) — o primeiro derrubava o boot com um diálogo de erro nativo do Electron, batizado e corrigido antes do segundo aparecer: `nestjs-pino` crashava no boot tentando carregar `pino-pretty` — esse transport só é usado quando `NODE_ENV !== "production"`, e o Electron nunca setava `NODE_ENV` ao spawnar o processo filho; `pino-pretty` é `devDependency` (formatação de log de terminal, sem uso num processo gerenciado pelo Electron) e `pnpm deploy --prod` corretamente a excluiu do bundle. Corrigido setando `NODE_ENV: app.isPackaged ? "production" : "development"` no `env` do `spawn()`. O segundo bug só apareceu depois de corrigir o primeiro e testar de novo: `JWT_SECRET` ausente (`.env` de dev removido do bundle, sem substituto) e nenhum usuário existente (seed de dev não roda em produção) — os dois já descritos acima e corrigidos com `resolveJwtSecret()` (Electron) e `ensureAdminUser()` (pdv-backend). Confirma a lição da Sprint 1 de novo: só testar em dev não prova que o pacote final funciona, e às vezes é preciso mais de uma rodada de teste-fix-teste pra achar tudo. Empacotamento real via `electron-builder` também esbarrou em duas limitações deste ambiente de desenvolvimento específico: rede instável pra `release-assets.githubusercontent.com` (contornado com `ELECTRON_OVERRIDE_DIST_PATH` apontando pro binário que o pacote `electron` já baixa sozinho) e falta de privilégio de symlink do Windows ao extrair ferramentas de assinatura de código não usadas (contornado com `signAndEditExecutable: false` + `CSC_IDENTITY_AUTO_DISCOVERY=false`, já que não há certificado de assinatura ainda). Nenhuma das duas deve ocorrer numa máquina de desenvolvimento normal com privilégios padrão.

## Auto Update

`electron-updater` (`src/main/auto-update.ts`), canal estável configurado via `build.publish` (GitHub Releases, `Chanciier/EasyPDV`) no `package.json`. Checagem no boot + a cada 4h. **Nunca aplica update com uma `CashSession` aberta em qualquer caixa do terminal** — `GET /provisioning/busy-status` (novo endpoint sem auth, Sprint 10) confirma antes de instalar; se ocupado, reavalia a cada 10min até liberar, em vez de esperar o próximo ciclo de 4h inteiro. Requer uma release real publicada no `publish` configurado pra fazer alguma coisa — sem isso, `checkForUpdates()` simplesmente não acha nada, não é testável ponta a ponta localmente.

## Provisionamento de terminal (Intermediador)

`apps/intermediador`: módulo `organizations` — `Organization`/`Store` (já existiam desde o Sprint 0) + `ActivationCode`/`Terminal` (Sprint 10). `POST /organizations/:id/activation-codes` gera um código de 8 caracteres (alfabeto sem 0/O/1/I/L), expira em 30min, uso único. `POST /terminals/activate` troca o código por um Terminal + apiKey (SHA-256 armazenado, texto puro só na resposta). `TerminalApiKeyGuard` protege `POST /sync` — o único endpoint do Intermediador com autenticação real até agora. Ver docs/API.md e docs/DATABASE.md.

## Hardware (Sprint 11, ainda não implementado)

Impressora, gaveta e leitor ficam atrás de uma interface interna comum no Main Process (`PrinterDriver` etc.) — trocar de fabricante não deve tocar Renderer nem Preload. Impressora de referência: Elgin i9/L42 Pro Full (pode mudar). Leitor de código de barras USB-teclado é capturado direto pelo Renderer, sem IPC. Canais IPC de hardware seguirão a convenção `domínio:ação` (`printer:print`, `drawer:open`, `scanner:onScan`) já estabelecida.

## Segurança

`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, módulo `remote` desabilitado, whitelist explícita de canais IPC (`activation:completed` até agora), CSP estrita na `BrowserWindow` (ainda não configurada explicitamente — TODO antes do lançamento). Sem ícone próprio (`resources/icon.ico`) ainda — `electron-builder` usa o ícone genérico padrão; branding real é decisão do usuário, fora do escopo desta sprint.
