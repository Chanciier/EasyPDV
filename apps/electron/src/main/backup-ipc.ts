import { ipcMain } from "electron";
import type { BackupInfo } from "@easypdv/shared-types";
import {
  assertValidBackupName,
  createBackup,
  createBackupUnlocked,
  listBackups,
  restoreBackupUnlocked,
  withBackupLock,
} from "./backup.js";
import { assertTrustedSender, InvalidIpcPayloadError } from "./ipc-guard.js";

export interface BackupIpcDeps {
  /** Resolve só depois que o processo do backend saiu (arquivo do SQLite liberado). */
  stopBackend: () => Promise<void>;
  startBackend: () => Promise<void>;
  reloadWindow: () => void;
}

const BACKEND_ME_URL = "http://127.0.0.1:4001/auth/me";
const ROLE_CHECK_TIMEOUT_MS = 5_000;
/** Mesmos papéis que podem estornar venda (VOID_ROLES do frontend). */
const RESTORE_ROLES = new Set(["administrador", "gerente", "proprietario"]);

export const RESTORE_FORBIDDEN_MESSAGE = "Restaurar backup é só para gerência — peça a um gerente.";

/**
 * SEG-05 (2026-10-22): o papel é conferido pelo próprio backend, não pelo
 * que o Renderer diz. O Renderer manda o accessToken que já tem (o mesmo
 * que vai no header de toda chamada à API) como argumento do IPC; o Main
 * pergunta ao backend local de quem é esse token. Token inválido/expirado
 * ou papel sem permissão → recusa antes de mexer em qualquer arquivo.
 */
async function assertCanRestore(accessToken: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(BACKEND_ME_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(ROLE_CHECK_TIMEOUT_MS),
    });
  } catch {
    throw new Error("Não foi possível conferir o usuário no PDV. Tente de novo.");
  }
  if (response.status === 401) {
    throw new Error("Sessão expirada. Entre de novo e tente restaurar.");
  }
  if (!response.ok) {
    throw new Error("Não foi possível conferir o usuário no PDV. Tente de novo.");
  }
  const user = (await response.json()) as { role?: unknown };
  if (typeof user.role !== "string" || !RESTORE_ROLES.has(user.role)) {
    throw new Error(RESTORE_FORBIDDEN_MESSAGE);
  }
}

/** Canais IPC de backup — convenção `domínio:ação` já estabelecida (Sprint 11). Todos conferem o remetente (SEG-04). */
export function registerBackupIpc(deps: BackupIpcDeps): void {
  ipcMain.handle("backup:create", async (event): Promise<BackupInfo> => {
    assertTrustedSender(event);
    return createBackup();
  });

  ipcMain.handle("backup:list", async (event): Promise<BackupInfo[]> => {
    assertTrustedSender(event);
    return listBackups();
  });

  /**
   * Restaurar sobrescreve o banco atual — não dá pra trocar o arquivo com o
   * backend rodando (lock do SQLite). Ordem (SEG-05, 2026-10-22):
   * 1. remetente, nome do arquivo e papel conferidos ANTES de parar nada;
   * 2. dentro do mutex de backup: backup de segurança do estado atual →
   *    para o backend (esperando o processo sair) → troca o arquivo;
   * 3. `finally`: religa o backend e recarrega a janela SEMPRE — antes, uma
   *    falha na cópia deixava o PDV sem backend até reiniciar o app.
   */
  ipcMain.handle("backup:restore", async (event, fileName: unknown, accessToken: unknown): Promise<void> => {
    assertTrustedSender(event);
    if (typeof fileName !== "string" || fileName.length > 200) {
      throw new InvalidIpcPayloadError("nome de backup inválido.");
    }
    if (typeof accessToken !== "string" || accessToken.length === 0 || accessToken.length > 4096) {
      throw new Error(RESTORE_FORBIDDEN_MESSAGE);
    }
    await assertValidBackupName(fileName);
    await assertCanRestore(accessToken);

    await withBackupLock(async () => {
      // Falhou o backup de segurança → nada foi parado ainda, só propaga.
      await createBackupUnlocked();
      await deps.stopBackend();
      try {
        await restoreBackupUnlocked(fileName);
      } finally {
        try {
          await deps.startBackend();
        } catch (error) {
          console.error("Backend não voltou depois da restauração:", error);
          throw new Error("O PDV não conseguiu religar depois da restauração. Feche e abra o EasyPDV.");
        } finally {
          deps.reloadWindow();
        }
      }
    });
  });
}
