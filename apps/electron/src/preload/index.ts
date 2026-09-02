import { contextBridge, ipcRenderer } from "electron";

/**
 * Ponte segura entre o Renderer (Next.js, e também resources/activation.html —
 * mesma BrowserWindow, preload se aplica aos dois) e o Main. Nunca expõe
 * ipcRenderer cru — só funções nomeadas. Ver
 * Claude/Projetos/EasyPDV/Arquitetura e Stack.md no cofre Obsidian.
 */
contextBridge.exposeInMainWorld("easypdv", {
  version: process.env.npm_package_version ?? "0.0.0",
  // resources/activation.html chama isso após POST /provisioning/activate ter
  // sucesso — o Main é quem decide trocar pra janela do app real (loadFile),
  // a página de ativação não tem esse poder sozinha (contextIsolation).
  activationCompleted: () => ipcRenderer.send("activation:completed"),

  // Hardware (Sprint 11) — canais domínio:ação, ver docs/ELECTRON.md.
  printReceipt: (payload: unknown) => ipcRenderer.invoke("printer:print", payload),
  openDrawer: () => ipcRenderer.invoke("drawer:open"),
  listPrinters: () => ipcRenderer.invoke("printers:list"),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSettings: (partial: unknown) => ipcRenderer.invoke("settings:set", partial),

  // Backup local (Sprint 15) — ver docs/ELECTRON.md.
  createBackup: () => ipcRenderer.invoke("backup:create"),
  listBackups: () => ipcRenderer.invoke("backup:list"),
  restoreBackup: (fileName: string) => ipcRenderer.invoke("backup:restore", fileName),

  // Atualização automática (2026-09-03) — botão "Atualizar agora" no
  // pos-shell. onUpdateDownloaded é um evento (Main -> Renderer, não
  // invoke/resposta), primeiro caso disso no projeto — devolve uma função de
  // cleanup pra quem assina poder desmontar sem vazar listener, mesmo padrão
  // que useEffect espera. Ver docs/ELECTRON.md e lib/app-update-store.ts.
  onUpdateDownloaded: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("update:downloaded", listener);
    return () => ipcRenderer.removeListener("update:downloaded", listener);
  },
  applyUpdateNow: () => ipcRenderer.invoke("update:apply-now") as Promise<{ applied: boolean }>,
});
