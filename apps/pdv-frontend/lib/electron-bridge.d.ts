import type { BackupInfo, HardwareSettings, ReceiptPrintPayload } from "@easypdv/shared-types";

/**
 * window.easypdv só existe dentro do Electron (preload/index.ts) — em
 * `next dev` puro (navegador comum) fica undefined, todo hook que usa isso
 * precisa checar antes de chamar. Ver docs/ELECTRON.md e hooks/use-hardware.ts.
 */
export interface EasyPdvBridge {
  version: string;
  activationCompleted: () => void;
  printReceipt: (payload: ReceiptPrintPayload) => Promise<void>;
  openDrawer: () => Promise<void>;
  listPrinters: () => Promise<string[]>;
  getSettings: () => Promise<HardwareSettings>;
  setSettings: (partial: Partial<HardwareSettings>) => Promise<HardwareSettings>;
  createBackup: () => Promise<BackupInfo>;
  listBackups: () => Promise<BackupInfo[]>;
  restoreBackup: (fileName: string) => Promise<void>;
}

declare global {
  interface Window {
    easypdv?: EasyPdvBridge;
  }
}
