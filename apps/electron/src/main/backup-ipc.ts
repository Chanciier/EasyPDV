import { ipcMain } from "electron";
import type { BackupInfo } from "@easypdv/shared-types";
import { createBackup, listBackups, restoreBackup } from "./backup.js";

export interface BackupIpcDeps {
  stopBackend: () => void;
  startBackend: () => Promise<void>;
  reloadWindow: () => void;
}

/** Canais IPC de backup — convenção `domínio:ação` já estabelecida (Sprint 11). */
export function registerBackupIpc(deps: BackupIpcDeps): void {
  ipcMain.handle("backup:create", async (): Promise<BackupInfo> => {
    return createBackup();
  });

  ipcMain.handle("backup:list", async (): Promise<BackupInfo[]> => {
    return listBackups();
  });

  /**
   * Restaurar sobrescreve o banco atual — não dá pra trocar o arquivo com o
   * backend rodando (lock do SQLite), então: backup de segurança do estado
   * atual → para o backend → troca o arquivo → religa o backend → recarrega
   * a janela (o frontend precisa relogar/reconsultar tudo do zero).
   */
  ipcMain.handle("backup:restore", async (_event, fileName: string): Promise<void> => {
    await createBackup();
    deps.stopBackend();
    await restoreBackup(fileName);
    await deps.startBackend();
    deps.reloadWindow();
  });
}
