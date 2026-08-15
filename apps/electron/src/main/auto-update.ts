import { autoUpdater } from "electron-updater";

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4h — terminal de loja, não precisa ser agressivo
const INSTALL_RETRY_INTERVAL_MS = 10 * 60 * 1000; // 10min — reavalia se o caixa liberou
const BACKEND_BUSY_STATUS_URL = "http://127.0.0.1:4001/provisioning/busy-status";

let updateReadyToInstall = false;

/**
 * Checa atualização no boot + periodicamente. Uma vez baixada, só instala
 * quando GET /provisioning/busy-status confirmar nenhuma CashSession aberta
 * em nenhum caixa do terminal (não escopado por operador — ver
 * GetTerminalBusyStatusUseCase) — se estava ocupado no momento do download,
 * reavalia a cada INSTALL_RETRY_INTERVAL_MS até liberar, em vez de esperar o
 * próximo ciclo de 4h. Requer `build.publish` configurado em package.json
 * (electron-builder) apontando pra onde as releases assinadas são
 * publicadas; sem uma release real publicada lá, checkForUpdates()
 * simplesmente não acha nada — não é testável ponta a ponta localmente. Ver
 * docs/ELECTRON.md.
 */
export function setupAutoUpdate(): void {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on("update-downloaded", () => {
    updateReadyToInstall = true;
    void tryInstallIfIdle();
  });

  autoUpdater.on("error", (error) => {
    console.error("electron-updater:", error);
  });

  checkForUpdates();
  setInterval(checkForUpdates, CHECK_INTERVAL_MS);
  setInterval(() => void tryInstallIfIdle(), INSTALL_RETRY_INTERVAL_MS);
}

function checkForUpdates(): void {
  autoUpdater.checkForUpdates().catch((error: unknown) => {
    console.error("Falha ao checar atualização:", error);
  });
}

async function hasOpenCashSession(): Promise<boolean> {
  try {
    const response = await fetch(BACKEND_BUSY_STATUS_URL);
    if (!response.ok) return true;
    const status = (await response.json()) as { hasOpenCashSession: boolean };
    return status.hasOpenCashSession;
  } catch {
    // Não deu pra confirmar — assume ocupado, não arrisca atualizar no meio de uma venda.
    return true;
  }
}

async function tryInstallIfIdle(): Promise<void> {
  if (!updateReadyToInstall) return;
  const busy = await hasOpenCashSession();
  if (busy) {
    console.log("Atualização pronta, mas há caixa aberto — reavalia em breve.");
    return;
  }
  autoUpdater.quitAndInstall();
}
