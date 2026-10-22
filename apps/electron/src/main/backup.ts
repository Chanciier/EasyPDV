import { app } from "electron";
import fsp from "node:fs/promises";
import path from "node:path";
import type { BackupInfo } from "@easypdv/shared-types";

/**
 * Backup local automático (Sprint 15) — cópia periódica do easypdv.db pra
 * uma pasta de backup local, com rotação. Sem envio pra nuvem/Intermediador
 * nesta rodada (decisão confirmada com o usuário).
 *
 * **2026-08-19: SQLite passou a rodar em modo WAL** (`PrismaService`, achado
 * real — sem WAL, uma transação de escrita longa como o sync do catálogo
 * Bling travava o app inteiro). A cópia dos sidecars `-wal`/`-shm` abaixo,
 * que já existia defensivamente "pra não quebrar se isso mudar", passou a
 * ser necessária de verdade. Risco NÃO tratado ainda (latente, sem sintoma
 * reportado): copiar `.db` + `.db-wal` com `fs.copyFileSync` não é atômico
 * entre os dois arquivos — uma escrita concorrente entre as duas cópias
 * poderia, em teoria, deixar o par inconsistente. Mitigação correta seria
 * pedir um `PRAGMA wal_checkpoint(TRUNCATE)` ao pdv-backend (única conexão
 * viva com o banco) antes de copiar, esvaziando o `-wal` — não implementado
 * ainda, fica como follow-up (ver Decisões e Riscos Abertos no cofre
 * Obsidian). Janela de risco é pequena (escritas de POS são esporádicas,
 * backup roda a cada 6h + no boot), mas existe.
 *
 * **2026-10-22 (PERF-09 + SEG-05):** toda a E/S passou a `fs.promises` — a
 * cópia síncrona congelava a thread principal (janela sem resposta, IPC de
 * impressão parado) a cada 6 h e atrasava o boot. Com cópia assíncrona, um
 * backup agendado poderia correr junto com um restore e copiar um banco pela
 * metade, então backup e restore passam por um mutex (`withBackupLock`).
 */

const MAX_BACKUPS = 10;
const SIDECAR_SUFFIXES = ["-wal", "-shm"];
/** Mesmo formato exato gerado por `timestampedFileName()` abaixo — usado pra validar `fileName` em `restoreBackup` (achado H2 da auditoria de segurança). */
const BACKUP_FILE_NAME_PATTERN = /^easypdv-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.db$/;
/** Backup do boot espera a janela abrir e o operador começar a trabalhar (PERF-09). */
const BOOT_BACKUP_DELAY_MS = 60_000;

export function resolveDatabasePath(): string {
  return path.join(app.getPath("userData"), "easypdv.db");
}

function resolveBackupsDir(): string {
  return path.join(app.getPath("userData"), "backups");
}

function timestampedFileName(): string {
  return `easypdv-${new Date().toISOString().replace(/[:.]/g, "-")}.db`;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function copyIfExists(source: string, dest: string): Promise<void> {
  if (await exists(source)) {
    await fsp.copyFile(source, dest);
  }
}

async function toBackupInfo(backupsDir: string, fileName: string): Promise<BackupInfo> {
  const stats = await fsp.stat(path.join(backupsDir, fileName));
  return { fileName, createdAt: stats.birthtime.toISOString(), sizeBytes: stats.size };
}

// ---------------------------------------------------------------------------
// Mutex backup × restore
// ---------------------------------------------------------------------------

let lockTail: Promise<void> = Promise.resolve();
let lockHolders = 0;

/** true enquanto um backup/restore está rodando ou na fila — o backup agendado pula o ciclo. */
export function isBackupBusy(): boolean {
  return lockHolders > 0;
}

/**
 * Fila simples: cada operação espera a anterior terminar. O restore segura
 * o lock do backup de segurança até o backend voltar, então nenhum backup
 * copia o banco enquanto ele está sendo trocado.
 */
export async function withBackupLock<T>(task: () => Promise<T>): Promise<T> {
  lockHolders += 1;
  const previous = lockTail;
  let release!: () => void;
  lockTail = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    await previous;
    return await task();
  } finally {
    lockHolders -= 1;
    release();
  }
}

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------

/** Cria um backup SEM pegar o lock — só para quem já está dentro de `withBackupLock` (restore). */
/** `keepFileName`: backup que não pode ser podado (o alvo de um restore em andamento). */
export async function createBackupUnlocked(keepFileName?: string): Promise<BackupInfo> {
  const dbPath = resolveDatabasePath();
  const backupsDir = resolveBackupsDir();
  await fsp.mkdir(backupsDir, { recursive: true });

  const fileName = timestampedFileName();
  const destPath = path.join(backupsDir, fileName);
  await fsp.copyFile(dbPath, destPath);
  for (const suffix of SIDECAR_SUFFIXES) {
    await copyIfExists(`${dbPath}${suffix}`, `${destPath}${suffix}`);
  }

  await pruneOldBackups(backupsDir, keepFileName);
  return toBackupInfo(backupsDir, fileName);
}

export function createBackup(): Promise<BackupInfo> {
  return withBackupLock(createBackupUnlocked);
}

async function pruneOldBackups(backupsDir: string, keepFileName?: string): Promise<void> {
  const files = (await fsp.readdir(backupsDir)).filter((f) => f.endsWith(".db") && f !== keepFileName);
  const limit = keepFileName ? MAX_BACKUPS - 1 : MAX_BACKUPS;
  if (files.length <= limit) return;

  const withMtime = await Promise.all(
    files.map(async (f) => ({ f, mtimeMs: (await fsp.stat(path.join(backupsDir, f))).mtimeMs })),
  );
  withMtime.sort((a, b) => b.mtimeMs - a.mtimeMs);
  for (const { f } of withMtime.slice(limit)) {
    await fsp.rm(path.join(backupsDir, f), { force: true });
    for (const suffix of SIDECAR_SUFFIXES) {
      await fsp.rm(path.join(backupsDir, `${f}${suffix}`), { force: true });
    }
  }
}

export async function listBackups(): Promise<BackupInfo[]> {
  const backupsDir = resolveBackupsDir();
  if (!(await exists(backupsDir))) return [];
  const names = (await fsp.readdir(backupsDir)).filter((f) => f.endsWith(".db"));
  const infos = await Promise.all(names.map((fileName) => toBackupInfo(backupsDir, fileName)));
  return infos.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ---------------------------------------------------------------------------
// Restore
// ---------------------------------------------------------------------------

/**
 * Valida o nome e devolve o caminho do backup — chamado ANTES de parar o
 * backend (SEG-05), pra um nome inválido não deixar o PDV sem backend.
 *
 * Achado H2 da auditoria de segurança (2026-09-14, cofre Obsidian
 * "Auditoria de Segurança Completa — EasyPDV"): `fileName` vem do Renderer
 * via IPC. Sem validar, um nome com "..\" escapava `backupsDir` via
 * path.join e sobrescrevia o banco de produção com qualquer arquivo legível
 * do disco. path.basename() + regex contra o formato real de
 * timestampedFileName() garante que só um nome de backup de verdade passa; o
 * resolve() abaixo é defesa extra.
 */
export async function assertValidBackupName(fileName: string): Promise<string> {
  const backupsDir = resolveBackupsDir();
  const safeName = path.basename(fileName);
  if (!BACKUP_FILE_NAME_PATTERN.test(safeName)) {
    throw new Error(`Nome de backup inválido: "${fileName}".`);
  }
  const sourcePath = path.join(backupsDir, safeName);
  if (path.resolve(sourcePath) !== path.join(path.resolve(backupsDir), safeName)) {
    throw new Error(`Nome de backup inválido: "${fileName}".`);
  }
  if (!(await exists(sourcePath))) {
    throw new Error(`Backup "${safeName}" não encontrado.`);
  }
  return sourcePath;
}

/**
 * Só pode ser chamado com o backend PARADO (lock do SQLite) e dentro de
 * `withBackupLock` — orquestrado por backup-ipc.ts: backup de segurança →
 * stopBackend() → restoreBackupUnlocked() → startBackend(). Sobrescreve o
 * banco atual.
 */
export async function restoreBackupUnlocked(fileName: string): Promise<void> {
  const sourcePath = await assertValidBackupName(fileName);
  const dbPath = resolveDatabasePath();
  await fsp.copyFile(sourcePath, dbPath);
  for (const suffix of SIDECAR_SUFFIXES) {
    const sidecarSource = `${sourcePath}${suffix}`;
    const sidecarDest = `${dbPath}${suffix}`;
    if (await exists(sidecarSource)) {
      await fsp.copyFile(sidecarSource, sidecarDest);
    } else {
      // Backup não tem sidecar (journal padrão) mas o banco atual tem
      // (não deveria, mas por segurança) — remove pra não misturar estados.
      await fsp.rm(sidecarDest, { force: true });
    }
  }
}

// ---------------------------------------------------------------------------
// Agendamento
// ---------------------------------------------------------------------------

async function runScheduledBackup(label: string): Promise<void> {
  if (isBackupBusy()) {
    console.log(`Backup automático (${label}) pulado: backup/restauração em andamento.`);
    return;
  }
  try {
    await createBackup();
  } catch (error) {
    console.error(`Backup automático (${label}) falhou:`, error);
  }
}

/**
 * Chamado depois da janela carregar (PERF-09): o backup do boot roda ~1 min
 * depois (se ainda não houver backup do dia) e depois a cada `intervalHours`.
 */
export function scheduleAutoBackup(intervalHours = 6): NodeJS.Timeout {
  setTimeout(() => {
    void (async () => {
      const today = new Date().toISOString().slice(0, 10);
      try {
        const hasBackupToday = (await listBackups()).some((b) => b.createdAt.slice(0, 10) === today);
        if (hasBackupToday) return;
      } catch (error) {
        console.error("Não foi possível listar backups no boot:", error);
      }
      await runScheduledBackup("boot");
    })();
  }, BOOT_BACKUP_DELAY_MS);

  return setInterval(() => void runScheduledBackup("agendado"), intervalHours * 60 * 60 * 1000);
}
