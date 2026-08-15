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
});
