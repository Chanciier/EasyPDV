import { app, BrowserWindow } from "electron";
import path from "node:path";

/**
 * Processo Main — único com acesso a hardware (impressora, gaveta, leitor) e
 * responsável por iniciar o pdv-backend local. Ver
 * Claude/Projetos/EasyPDV/Arquitetura e Stack.md no cofre Obsidian.
 *
 * Sprint 0: só abre a janela apontando para o export estático do frontend.
 * Sprints seguintes: spawnar o processo local do pdv-backend, provisionamento
 * de terminal, integração de hardware (ver ELECTRON.md em /docs).
 */
function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const frontendIndex = path.join(__dirname, "../../../pdv-frontend/out/index.html");
  void win.loadFile(frontendIndex);
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
