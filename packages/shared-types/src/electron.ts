// Contratos entre o Renderer (pdv-frontend) e o Main process do Electron
// (window.easypdv, via preload) — hardware (Sprint 11). Ver docs/ELECTRON.md.

export interface ReceiptItemPayload {
  name: string;
  quantity: number;
  totalAmount: number;
}

export interface ReceiptPrintPayload {
  saleId: string;
  confirmedAt: string;
  items: ReceiptItemPayload[];
  totalAmount: number;
  paymentLabel: string;
  received?: number;
  change?: number;
  storeName?: string;
}

export interface HardwareSettings {
  printerName: string | null;
  autoPrintReceipt: boolean;
  autoOpenDrawerOnCash: boolean;
}
