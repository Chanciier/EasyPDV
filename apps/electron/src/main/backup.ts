import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import type { BackupInfo } from "@easypdv/shared-types";

/**
 * Backup local automático (Sprint 15) — cópia periódica do easypdv.db pra
 * uma pasta de backup local, com rotação. Sem envio pra nuvem/Intermediador
 * nesta rodada (decisão confirmada com o usuário). SQLite deste projeto usa
 * o journal padrão (rollback), não WAL — confirmado sem `.db-wal`/`.db-shm`
 * ao lado do banco em uso normal — mas a cópia dos sidecars abaixo é
 * defensiva (não falha se não existirem), pra não quebrar se isso mudar.
 */

const MAX_BACKUPS = 10;
const SIDECAR_SUFFIXES = ["-wal", "-shm"];

export function resolveDatabasePath(): string {
  return path.join(app.getPath("userData"), "easypdv.db");
}

function resolveBackupsDir(): string {
  return path.join(app.getPath("userData"), "backups");
}

function timestampedFileName(): string {
  return `easypdv-${new Date().toISOString().replace(/[:.]/g, "-")}.db`;
}

function copyIfExists(source: string, dest: string): void {
  if (fs.existsSync(source)) {
    fs.copyFileSync(source, dest);
  }
}

function toBackupInfo(backupsDir: string, fileName: string): BackupInfo {
  const stats = fs.statSync(path.join(backupsDir, fileName));
  return { fileName, createdAt: stats.birthtime.toISOString(), sizeBytes: stats.size };
}

export async function createBackup(): Promise<BackupInfo> {
  const dbPath = resolveDatabasePath();
  const backupsDir = resolveBackupsDir();
  fs.mkdirSync(backupsDir, { recursive: true });

  const fileName = timestampedFileName();
  const destPath = path.join(backupsDir, fileName);
  fs.copyFileSync(dbPath, destPath);
  for (const suffix of SIDECAR_SUFFIXES) {
    copyIfExists(`${dbPath}${suffix}`, `${destPath}${suffix}`);
  }

  pruneOldBackups(backupsDir);
  return toBackupInfo(backupsDir, fileName);
}

function pruneOldBackups(backupsDir: string): void {
  const files = fs.readdirSync(backupsDir).filter((f) => f.endsWith(".db"));
  if (files.length <= MAX_BACKUPS) return;

  const withMtime = files.map((f) => ({ f, mtimeMs: fs.statSync(path.join(backupsDir, f)).mtimeMs }));
  withMtime.sort((a, b) => b.mtimeMs - a.mtimeMs);
  for (const { f } of withMtime.slice(MAX_BACKUPS)) {
    fs.unlinkSync(path.join(backupsDir, f));
    for (const suffix of SIDECAR_SUFFIXES) {
      const sidecar = path.join(backupsDir, `${f}${suffix}`);
      if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
    }
  }
}

export function listBackups(): BackupInfo[] {
  const backupsDir = resolveBackupsDir();
  if (!fs.existsSync(backupsDir)) return [];
  return fs
    .readdirSync(backupsDir)
    .filter((f) => f.endsWith(".db"))
    .map((fileName) => toBackupInfo(backupsDir, fileName))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Só pode ser chamado com o backend PARADO (lock do SQLite) — orquestrado
 * por quem chama (ver backup-ipc.ts): stopBackend() → restoreBackup() →
 * startBackend(). Sobrescreve o banco atual — quem chama já deve ter criado
 * um backup de segurança do estado atual antes.
 */
export async function restoreBackup(fileName: string): Promise<void> {
  const backupsDir = resolveBackupsDir();
  const sourcePath = path.join(backupsDir, fileName);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Backup "${fileName}" não encontrado.`);
  }
  const dbPath = resolveDatabasePath();
  fs.copyFileSync(sourcePath, dbPath);
  for (const suffix of SIDECAR_SUFFIXES) {
    const sidecarSource = `${sourcePath}${suffix}`;
    const sidecarDest = `${dbPath}${suffix}`;
    if (fs.existsSync(sidecarSource)) {
      fs.copyFileSync(sidecarSource, sidecarDest);
    } else if (fs.existsSync(sidecarDest)) {
      // Backup não tem sidecar (journal padrão) mas o banco atual tem
      // (não deveria, mas por segurança) — remove pra não misturar estados.
      fs.unlinkSync(sidecarDest);
    }
  }
}

/** Roda uma vez no boot (se não houver nenhum backup do dia) e depois a cada `intervalHours`. */
export function scheduleAutoBackup(intervalHours = 6): NodeJS.Timeout {
  const today = new Date().toISOString().slice(0, 10);
  const hasBackupToday = listBackups().some((b) => b.createdAt.slice(0, 10) === today);
  if (!hasBackupToday) {
    void createBackup().catch((error) => console.error("Backup automático (boot) falhou:", error));
  }
  return setInterval(
    () => {
      void createBackup().catch((error) => console.error("Backup automático (agendado) falhou:", error));
    },
    intervalHours * 60 * 60 * 1000,
  );
}
