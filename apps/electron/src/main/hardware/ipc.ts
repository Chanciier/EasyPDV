import { app, ipcMain } from "electron";
import path from "node:path";
import type { HardwareSettings, ReceiptPrintPayload } from "@easypdv/shared-types";
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

/** Canais IPC de hardware — convenção `domínio:ação` já estabelecida no Sprint 10. */
export function registerHardwareIpc(): void {
  ipcMain.handle("printer:print", async (_event, payload: ReceiptPrintPayload) => {
    const driver = resolveDriver(readSettings());
    const receipt = payload.fiscal ? buildFiscalReceipt(payload) : buildReceipt(payload);
    await driver.print(receipt);
  });

  ipcMain.handle("drawer:open", async () => {
    const driver = resolveDriver(readSettings());
    await driver.print(buildDrawerKick());
  });

  ipcMain.handle("printers:list", async () => {
    return listWindowsPrinters();
  });

  ipcMain.handle("settings:get", async () => {
    return readSettings();
  });

  ipcMain.handle("settings:set", async (_event, partial: Partial<HardwareSettings>) => {
    return writeSettings(partial);
  });
}
