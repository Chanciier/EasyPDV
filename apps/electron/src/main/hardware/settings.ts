import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { app } from "electron";
import type { HardwareSettings } from "@easypdv/shared-types";

const execFileAsync = promisify(execFile);

const DEFAULT_SETTINGS: HardwareSettings = {
  printerName: null,
  autoPrintReceipt: true,
  autoOpenDrawerOnCash: false,
};

function settingsPath(): string {
  return path.join(app.getPath("userData"), "settings.json");
}

export function readSettings(): HardwareSettings {
  try {
    const raw = fs.readFileSync(settingsPath(), "utf8");
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<HardwareSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function writeSettings(partial: Partial<HardwareSettings>): HardwareSettings {
  const merged = { ...readSettings(), ...partial };
  fs.writeFileSync(settingsPath(), JSON.stringify(merged, null, 2));
  return merged;
}

/**
 * Enumera impressoras cadastradas no Windows via `System.Drawing.Printing.PrinterSettings`
 * (winspool, mesma família de API do driver de impressão raw) — não `Get-Printer`
 * (módulo PrintManagement, baseado em CIM/WMI). Achado em campo (2026-08-21, terminal
 * novo com impressora App-Tech POS-80C): `Get-Printer` falha com
 * "CimJob_BrokenCimSession" em máquinas com o provedor CIM de impressão quebrado
 * (bug conhecido do Windows, independente do Spooler estar rodando) — nessas
 * máquinas o dropdown de impressora ficava sempre vazio, sem nenhum erro visível
 * pro usuário. `PrinterSettings.InstalledPrinters` não depende de CIM.
 */
export async function listWindowsPrinters(): Promise<string[]> {
  const { stdout } = await execFileAsync("powershell.exe", [
    "-NoProfile",
    "-Command",
    "Add-Type -AssemblyName System.Drawing; [System.Drawing.Printing.PrinterSettings]::InstalledPrinters",
  ]);
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
