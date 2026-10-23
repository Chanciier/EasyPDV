import type { IpcMainEvent, IpcMainInvokeEvent, WebContents } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { HardwareSettings, ReceiptPrintPayload } from "@easypdv/shared-types";

/**
 * SEG-04 (rodada de melhorias 2026-10-22) — toda chamada IPC do Renderer
 * passa por aqui antes de tocar em hardware, backup, ativação ou update.
 *
 * Por quê: qualquer janela/frame com o preload ganha `window.easypdv`
 * (restaurar backup, trocar impressora, abrir gaveta...). Mesmo com
 * `setWindowOpenHandler`/`will-navigate` bloqueando conteúdo remoto (ver
 * index.ts), o Main não confia só nisso — confere que quem chamou é o frame
 * principal da janela do PDV e que ele está mostrando um arquivo do próprio
 * app (export do pdv-frontend ou resources/activation.html).
 *
 * Validação dos payloads é manual (sem Zod): o pacote electron não tem zod
 * como dependência e o lockfile está congelado nesta rodada. Mesmo efeito
 * de um schema `.strict()` onde importa (settings) e de um `.passthrough()`
 * com tipos básicos onde não importa (impressão).
 */

interface IpcGuardConfig {
  /** Pastas cujos arquivos podem chamar o IPC (frontend exportado, resources/). */
  allowedRoots: string[];
  /** webContents da janela principal — resolvido a cada chamada (pode ainda não existir). */
  getMainWebContents: () => WebContents | null | undefined;
}

let config: IpcGuardConfig = { allowedRoots: [], getMainWebContents: () => null };

export function configureIpcGuard(next: IpcGuardConfig): void {
  config = { ...next, allowedRoots: next.allowedRoots.map((root) => normalizePath(path.resolve(root))) };
}

/** Windows não diferencia maiúsculas em caminho — compara tudo normalizado. */
function normalizePath(value: string): string {
  return process.platform === "win32" ? value.toLowerCase() : value;
}

/** `file://` de dentro de uma das pastas do app — usado pelo IPC e pelo `will-navigate`. */
export function isAppFileUrl(url: string): boolean {
  if (!url.startsWith("file://")) return false;
  let filePath: string;
  try {
    filePath = normalizePath(path.resolve(fileURLToPath(url)));
  } catch {
    return false;
  }
  return config.allowedRoots.some((root) => filePath === root || filePath.startsWith(root + path.sep));
}

export class UntrustedSenderError extends Error {
  constructor() {
    super("Chamada recusada: origem não confiável.");
    this.name = "UntrustedSenderError";
  }
}

/** true só para o frame principal da janela do PDV mostrando um arquivo do app. */
export function isTrustedSender(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
  const main = config.getMainWebContents();
  if (!main || event.sender !== main) return false;
  const frame = event.senderFrame;
  // Frame de topo (sem pai): iframe dentro da página não fala com o Main.
  if (!frame || frame.parent !== null) return false;
  return isAppFileUrl(frame.url);
}

export function assertTrustedSender(event: IpcMainEvent | IpcMainInvokeEvent): void {
  if (!isTrustedSender(event)) {
    console.warn(`IPC recusado de origem não confiável: ${event.senderFrame?.url ?? "(sem frame)"}`);
    throw new UntrustedSenderError();
  }
}

// ---------------------------------------------------------------------------
// Validação de payloads
// ---------------------------------------------------------------------------

export class InvalidIpcPayloadError extends Error {
  constructor(detail: string) {
    super(`Dados inválidos: ${detail}`);
    this.name = "InvalidIpcPayloadError";
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string" || value.length > maxLength) {
    throw new InvalidIpcPayloadError(`${field} deve ser texto de até ${maxLength} caracteres.`);
  }
  return value;
}

function optionalString(value: unknown, field: string, maxLength: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  return requireString(value, field, maxLength);
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new InvalidIpcPayloadError(`${field} deve ser um número.`);
  }
  return value;
}

function optionalNumber(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  return requireNumber(value, field);
}

function requireArray(value: unknown, field: string, maxLength: number): unknown[] {
  if (!Array.isArray(value) || value.length > maxLength) {
    throw new InvalidIpcPayloadError(`${field} deve ser uma lista de até ${maxLength} itens.`);
  }
  return value;
}

const SETTINGS_KEYS = new Set<keyof HardwareSettings>(["printerName", "autoPrintReceipt", "autoOpenDrawerOnCash"]);

/**
 * `settings:set` — equivalente a um schema `.strict()`: só as três chaves
 * conhecidas, com o tipo certo. Se a impressora mudar, quem chama
 * (hardware/ipc.ts) ainda confere que ela existe no Windows.
 */
export function parseSettingsPatch(input: unknown): Partial<HardwareSettings> {
  if (!isPlainObject(input)) throw new InvalidIpcPayloadError("configurações devem ser um objeto.");
  const patch: Partial<HardwareSettings> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!SETTINGS_KEYS.has(key as keyof HardwareSettings)) {
      throw new InvalidIpcPayloadError(`campo desconhecido "${key}".`);
    }
    if (key === "printerName") {
      if (value === null || value === "") {
        patch.printerName = null;
      } else {
        patch.printerName = requireString(value, "printerName", 256);
      }
    } else if (typeof value !== "boolean") {
      throw new InvalidIpcPayloadError(`${key} deve ser verdadeiro ou falso.`);
    } else {
      patch[key as "autoPrintReceipt" | "autoOpenDrawerOnCash"] = value;
    }
  }
  return patch;
}

/**
 * `printer:print` — tipos básicos de `ReceiptPrintPayload`, só pra um
 * payload malformado não derrubar o formatador do cupom. `fiscal` é
 * opcional (ajuste do sign-off): "Imprimir cupom" sem NFC-e manda o
 * comprovante não fiscal, sem esse bloco.
 */
export function parsePrintPayload(input: unknown): ReceiptPrintPayload {
  if (!isPlainObject(input)) throw new InvalidIpcPayloadError("cupom deve ser um objeto.");

  const items = requireArray(input.items, "items", 500).map((raw, index) => {
    if (!isPlainObject(raw)) throw new InvalidIpcPayloadError(`items[${index}] deve ser um objeto.`);
    return {
      name: requireString(raw.name, `items[${index}].name`, 500),
      quantity: requireNumber(raw.quantity, `items[${index}].quantity`),
      totalAmount: requireNumber(raw.totalAmount, `items[${index}].totalAmount`),
    };
  });

  const payments = requireArray(input.payments, "payments", 50).map((raw, index) => {
    if (!isPlainObject(raw)) throw new InvalidIpcPayloadError(`payments[${index}] deve ser um objeto.`);
    return {
      label: requireString(raw.label, `payments[${index}].label`, 200),
      amount: requireNumber(raw.amount, `payments[${index}].amount`),
      received: optionalNumber(raw.received, `payments[${index}].received`),
      change: optionalNumber(raw.change, `payments[${index}].change`),
    };
  });

  let fiscal: ReceiptPrintPayload["fiscal"];
  if (input.fiscal !== undefined && input.fiscal !== null) {
    if (!isPlainObject(input.fiscal)) throw new InvalidIpcPayloadError("fiscal deve ser um objeto.");
    fiscal = {
      documentNumber: requireString(input.fiscal.documentNumber, "fiscal.documentNumber", 50),
      accessKey: requireString(input.fiscal.accessKey, "fiscal.accessKey", 100),
      qrCodeUrl: requireString(input.fiscal.qrCodeUrl, "fiscal.qrCodeUrl", 2000),
    };
  }

  return {
    saleId: requireString(input.saleId, "saleId", 100),
    confirmedAt: requireString(input.confirmedAt, "confirmedAt", 100),
    items,
    totalAmount: requireNumber(input.totalAmount, "totalAmount"),
    payments,
    storeName: optionalString(input.storeName, "storeName", 200),
    fiscal,
    customerDocument: optionalString(input.customerDocument, "customerDocument", 30),
  };
}
