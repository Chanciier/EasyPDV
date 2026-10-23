import { app, ipcMain } from "electron";
import path from "node:path";
import type { HardwareSettings } from "@easypdv/shared-types";
import { assertTrustedSender, InvalidIpcPayloadError, parsePrintPayload, parseSettingsPatch } from "../ipc-guard.js";
import { MockPrinterDriver } from "./mock-printer.driver.js";
import type { PrinterDriver } from "./printer-driver.js";
import { buildDrawerKick, buildFiscalReceipt, buildReceipt } from "./receipt-formatter.js";
import { listWindowsPrinters, readSettings, writeSettings } from "./settings.js";
import { WindowsRawPrinterDriver } from "./windows-raw-printer.driver.js";

/**
 * print-raw.ps1 precisa existir como arquivo real em disco — um processo
 * externo (`powershell.exe`) não consegue ler de dentro do app.asar, ao
 * contrário de `loadFile`/`fs` do próprio Electron. Por isso ele vai em
 * `extraResources` (fora do asar, igual pdv-backend/pdv-frontend), não só
 * no `files: ["resources/**"]` que empacota dentro do asar. Ver package.json
 * e docs/ELECTRON.md.
 */
function resolvePrintScriptPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "print-raw.ps1");
  }
  return path.join(__dirname, "../../../resources/print-raw.ps1");
}

function resolveDriver(settings: HardwareSettings): PrinterDriver {
  if (!settings.printerName || process.env.EASYPDV_PRINTER_MOCK === "1") {
    return new MockPrinterDriver();
  }
  return new WindowsRawPrinterDriver(settings.printerName, resolvePrintScriptPath());
}

/**
 * Troca de impressora só para uma que o Windows lista (SEG-04): `printerName`
 * vai direto pro `OpenPrinter` — um caminho de rede arbitrário (`\\host\fila`)
 * faria o Windows autenticar via SMB num host externo. Manter a impressora
 * já salva não consulta o Windows de novo (listar custa um PowerShell, e o
 * diálogo sempre reenvia o nome atual junto com as caixas de seleção).
 */
async function assertKnownPrinter(patch: Partial<HardwareSettings>): Promise<void> {
  const name = patch.printerName;
  if (!name || name === readSettings().printerName) return;
  let installed: string[];
  try {
    installed = await listWindowsPrinters();
  } catch {
    throw new InvalidIpcPayloadError("não foi possível conferir a lista de impressoras do Windows.");
  }
  if (!installed.includes(name)) {
    throw new InvalidIpcPayloadError(`impressora "${name}" não está instalada neste computador.`);
  }
}

/** Canais IPC de hardware — convenção `domínio:ação` já estabelecida no Sprint 10. Todos conferem o remetente (SEG-04). */
export function registerHardwareIpc(): void {
  ipcMain.handle("printer:print", async (event, rawPayload: unknown) => {
    assertTrustedSender(event);
    const payload = parsePrintPayload(rawPayload);
    const driver = resolveDriver(readSettings());
    const receipt = payload.fiscal ? buildFiscalReceipt(payload) : buildReceipt(payload);
    await driver.print(receipt);
  });

  ipcMain.handle("drawer:open", async (event) => {
    assertTrustedSender(event);
    const driver = resolveDriver(readSettings());
    await driver.print(buildDrawerKick());
  });

  ipcMain.handle("printers:list", async (event) => {
    assertTrustedSender(event);
    return listWindowsPrinters();
  });

  ipcMain.handle("settings:get", async (event) => {
    assertTrustedSender(event);
    return readSettings();
  });

  ipcMain.handle("settings:set", async (event, rawPatch: unknown) => {
    assertTrustedSender(event);
    const patch = parseSettingsPatch(rawPatch);
    await assertKnownPrinter(patch);
    return writeSettings(patch);
  });
}
