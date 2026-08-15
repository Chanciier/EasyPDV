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

/** Enumera impressoras cadastradas no Windows — mesmo mecanismo `Get-Printer` já usado pra validar a Elgin nesta sprint. */
export async function listWindowsPrinters(): Promise<string[]> {
  const { stdout } = await execFileAsync("powershell.exe", [
    "-NoProfile",
    "-Command",
    "Get-Printer | Select-Object -ExpandProperty Name",
  ]);
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
