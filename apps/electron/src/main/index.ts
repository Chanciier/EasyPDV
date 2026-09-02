import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { setupAutoUpdate } from "./auto-update.js";
import { registerHardwareIpc } from "./hardware/ipc.js";
import { registerBackupIpc } from "./backup-ipc.js";
import { resolveDatabasePath, scheduleAutoBackup } from "./backup.js";

/**
 * Processo Main — único com acesso a hardware (impressora, gaveta, leitor,
 * Sprint 11) e responsável por iniciar o pdv-backend local. Ver
 * Claude/Projetos/EasyPDV/Arquitetura e Stack.md no cofre Obsidian e
 * docs/ELECTRON.md.
 */

// Fixa a identidade interna do app ANTES de qualquer app.getPath("userData")
// (JWT secret, banco SQLite, backups, settings.json — todos derivados daí).
// Sem isso, `app.name` seguiria `productName` do package.json por padrão —
// travado aqui (2026-09-03) pensando num rename futuro pra "Easy PDV"
// (pedido do usuário, adiado por risco documentado do electron-builder: com
// `allowToChangeInstallationDirectory: true`, mudar `productName` pode fazer
// o auto-update desempacotar numa pasta NOVA em vez de atualizar a instalação
// existente — precisa de plano de migração antes, não é só trocar a string).
// Enquanto isso não acontece, esta linha já garante que nenhuma mudança de
// `productName` vai mexer sozinha na pasta de userData de instalações reais.
app.setName("EasyPDV");

const BACKEND_PORT = 4001;
const BACKEND_HEALTH_URL = `http://127.0.0.1:${BACKEND_PORT}/health`;
const BACKEND_PROVISIONING_STATUS_URL = `http://127.0.0.1:${BACKEND_PORT}/provisioning/status`;

let backendProcess: ChildProcess | null = null;
let mainWindow: BrowserWindow | null = null;

/**
 * Dev: roda direto do monorepo (irmão de apps/electron). Empacotado:
 * electron-builder copia um bundle autocontido de pdv-backend (gerado via
 * `pnpm --filter @easypdv/pdv-backend deploy`, ver package.json) pra
 * resources/pdv-backend — sem symlinks do pnpm, resolução de módulo comum.
 */
function resolveBackendEntry(): { entry: string; cwd: string } {
  if (app.isPackaged) {
    const cwd = path.join(process.resourcesPath, "pdv-backend");
    return { entry: path.join(cwd, "dist", "main.js"), cwd };
  }
  const cwd = path.join(__dirname, "../../../pdv-backend");
  return { entry: path.join(cwd, "dist", "main.js"), cwd };
}

function resolveFrontendIndex(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "pdv-frontend", "index.html");
  }
  return path.join(__dirname, "../../../pdv-frontend/out/index.html");
}

function resolveActivationPage(): string {
  return path.join(__dirname, "../../resources/activation.html");
}

/** SQLite por instalação, fora da pasta somente-leitura do instalador. Ver docs/DATABASE.md. */
function resolveDatabaseUrl(): string {
  return `file:${resolveDatabasePath()}`;
}

/**
 * URL pública do Intermediador, hospedado no Railway (projeto
 * "celebrated-acceptance", serviço @easypdv/intermediador). Uma só URL vale
 * pra todas as instalações do EasyPDV (o Intermediador é multi-tenant, uma
 * organização por loja), então é uma constante de build, não algo
 * configurável por instalação como o JWT_SECRET.
 */
const PRODUCTION_INTERMEDIADOR_URL = "https://easypdvintermediador-production.up.railway.app";

/**
 * Sem isso, `HttpSyncGateway`/`HttpFiscalGateway`/`ActivateTerminalUseCase`
 * caem no default de dev (`http://127.0.0.1:4002`) — num instalador
 * empacotado de verdade, isso significa a loja tentando falar com
 * "localhost" nela mesma, nunca com o Intermediador real. Falha alto e
 * cedo em vez de deixar isso quebrar silenciosamente na loja piloto.
 */
function resolveIntermediadorUrl(): string | undefined {
  if (!app.isPackaged) {
    return undefined;
  }
  if (!PRODUCTION_INTERMEDIADOR_URL) {
    throw new Error(
      "PRODUCTION_INTERMEDIADOR_URL não configurado em apps/electron/src/main/index.ts — preencha com a URL pública do Railway antes de gerar um instalador de produção.",
    );
  }
  return PRODUCTION_INTERMEDIADOR_URL;
}

/**
 * JWT_SECRET é `getOrThrow` no IdentityModule — sem valor, o backend crasha
 * no boot (bug real, achado testando o instalador de verdade: o `.env` de
 * dev que fornecia isso é removido do bundle empacotado de propósito, ver
 * scripts/prepare-resources.js). Gerado uma vez por instalação e persistido
 * em userData — nunca hardcoded no código-fonte, senão toda instalação do
 * EasyPDV compartilharia o mesmo segredo de assinatura de token (qualquer um
 * que descompilasse o app conseguiria forjar um token válido pra QUALQUER
 * loja cliente). Reaproveitado entre boots pra não invalidar sessões
 * ativas a cada reinício.
 */
function resolveJwtSecret(): string {
  const secretPath = path.join(app.getPath("userData"), "jwt-secret");
  if (fs.existsSync(secretPath)) {
    return fs.readFileSync(secretPath, "utf8").trim();
  }
  const secret = randomBytes(48).toString("hex");
  fs.mkdirSync(path.dirname(secretPath), { recursive: true });
  fs.writeFileSync(secretPath, secret, { mode: 0o600 });
  return secret;
}

async function waitForHealth(url: string, timeoutMs = 30_000): Promise<void> {
  const start = Date.now();
  let lastError: unknown;
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`pdv-backend não respondeu em ${url} a tempo: ${String(lastError)}`);
}

/**
 * Sobe o pdv-backend como processo filho de verdade (não em processo,
 * separado — mesma fronteira que já existe em dev entre `pdv-frontend` e
 * `pdv-backend`). ELECTRON_RUN_AS_NODE faz o próprio binário do Electron se
 * comportar como um Node.js puro pra rodar o script — não precisa de uma
 * instalação separada de Node no PC do cliente. `runMigrations()` (dentro do
 * próprio pdv-backend, ver src/main.ts) aplica as migrations pendentes antes
 * de escutar a porta.
 */
async function startBackend(): Promise<void> {
  const { entry, cwd } = resolveBackendEntry();
  const intermediadorUrl = resolveIntermediadorUrl();

  backendProcess = spawn(process.execPath, [entry], {
    cwd,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      DATABASE_URL: resolveDatabaseUrl(),
      JWT_SECRET: resolveJwtSecret(),
      PORT: String(BACKEND_PORT),
      // Empacotado: o bundle deployado (pnpm deploy --prod) não tem
      // pino-pretty (devDependency) — sem NODE_ENV=production,
      // LoggerModule tenta usar esse transport e o Nest crasha no boot
      // (bug real, achado testando o instalador de verdade, não em dev).
      // Em dev mantém "development" — pino-pretty existe no monorepo local.
      NODE_ENV: app.isPackaged ? "production" : "development",
      ...(intermediadorUrl ? { INTERMEDIADOR_URL: intermediadorUrl } : {}),
    },
    stdio: "inherit",
  });

  backendProcess.on("exit", (code, signal) => {
    console.error(`pdv-backend encerrou (code=${code}, signal=${signal})`);
    backendProcess = null;
  });

  await waitForHealth(BACKEND_HEALTH_URL);
}

function stopBackend(): void {
  backendProcess?.kill();
  backendProcess = null;
}

async function isTerminalActivated(): Promise<boolean> {
  try {
    const response = await fetch(BACKEND_PROVISIONING_STATUS_URL);
    const status = (await response.json()) as { activated: boolean };
    return status.activated;
  } catch {
    // Falha ao consultar status: mostra a UI de ativação por segurança — ela
    // mesma volta a checar contra o backend antes de deixar ativar de novo.
    return false;
  }
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    // Empacotado: electron-builder já grava o ícone no .exe (build.win.icon)
    // via rcedit — isso aqui é só pra dev (`electron .` mostraria o ícone
    // padrão do Electron sem isso).
    icon: app.isPackaged ? undefined : path.join(__dirname, "../../build/icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  return win;
}

/**
 * PDV de loja fica ligado o dia todo num terminal dedicado — sem isso, uma
 * queda de energia/reinício do Windows deixa o caixa fora do ar até alguém
 * abrir o app manualmente. `setLoginItemSettings` grava a entrada padrão do
 * Windows (Run key), sem depender de instalador/serviço à parte. Só faz
 * sentido empacotado — em dev o execPath aponta pro binário do Electron.
 */
function ensureAutoLaunch(): void {
  app.setLoginItemSettings({
    openAtLogin: true,
    path: process.execPath,
  });
}

async function boot(): Promise<void> {
  if (app.isPackaged) {
    ensureAutoLaunch();
  }

  try {
    await startBackend();
  } catch (error) {
    dialog.showErrorBox("EasyPDV", `Não foi possível iniciar o backend local.\n\n${String(error)}`);
    app.quit();
    return;
  }

  // Backup local automático (Sprint 15) — só depois do backend confirmar
  // health (migrations já aplicadas, banco em estado consistente).
  scheduleAutoBackup();

  mainWindow = createWindow();
  const activated = await isTerminalActivated();
  if (activated) {
    await mainWindow.loadFile(resolveFrontendIndex());
  } else {
    await mainWindow.loadFile(resolveActivationPage());
  }

  // Auto-update só faz sentido num app empacotado de verdade (precisa de
  // build.publish com uma release real por trás) — em dev, checkForUpdates()
  // só erraria por falta de metadata de update.
  if (app.isPackaged) {
    setupAutoUpdate(() => mainWindow);
  }
}

// Disparado por resources/activation.html (via preload) depois de
// POST /provisioning/activate ter sucesso — troca pra janela do app real.
ipcMain.on("activation:completed", () => {
  void mainWindow?.loadFile(resolveFrontendIndex());
});

registerHardwareIpc();
registerBackupIpc({
  stopBackend,
  startBackend,
  reloadWindow: () => mainWindow?.reload(),
});

app.whenReady().then(boot);

app.on("window-all-closed", () => {
  stopBackend();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopBackend();
});
