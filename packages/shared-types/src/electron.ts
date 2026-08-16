// Contratos entre o Renderer (pdv-frontend) e o Main process do Electron
// (window.easypdv, via preload) — hardware (Sprint 11). Ver docs/ELECTRON.md.

export interface ReceiptItemPayload {
  name: string;
  quantity: number;
  totalAmount: number;
}

// Sprint 14 — ausente = imprime o comprovante não-fiscal de sempre (caminho
// automático na confirmação da venda, inalterado); presente = imprime a
// variante fiscal (NFC-e, com chave de acesso + QR code), disparada manualmente
// pelo operador no Histórico só quando o documento fiscal já foi emitido.
export interface ReceiptFiscalDetail {
  documentNumber: string;
  accessKey: string;
  qrCodeUrl: string;
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
  fiscal?: ReceiptFiscalDetail;
}

export interface HardwareSettings {
  printerName: string | null;
  autoPrintReceipt: boolean;
  autoOpenDrawerOnCash: boolean;
}
