import { contextBridge } from "electron";

/**
 * Ponte segura entre o Renderer (Next.js) e o Main. Nunca expõe ipcRenderer cru —
 * só funções nomeadas. Canais IPC reais entram quando a integração de hardware
 * for implementada. Ver Claude/Projetos/EasyPDV/Arquitetura e Stack.md no cofre Obsidian.
 */
contextBridge.exposeInMainWorld("easypdv", {
  version: process.env.npm_package_version ?? "0.0.0",
});
