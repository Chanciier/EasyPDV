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

/** Pagamento dividido (2026-08-21) — uma entrada por perna de pagamento aprovada. `received`/`change` só fazem sentido pra dinheiro (não persistidos no backend, calculados na hora). */
export interface ReceiptPaymentPayload {
  label: string;
  amount: number;
  received?: number;
  change?: number;
}

export interface ReceiptPrintPayload {
  saleId: string;
  confirmedAt: string;
  items: ReceiptItemPayload[];
  totalAmount: number;
  payments: ReceiptPaymentPayload[];
  storeName?: string;
  fiscal?: ReceiptFiscalDetail;
  /** CPF do cliente na venda (2026-08-19) — impresso como linha "CPF: ..." quando presente, tanto no comprovante não-fiscal quanto no cupom fiscal reimpresso. */
  customerDocument?: string;
}

export interface HardwareSettings {
  printerName: string | null;
  autoPrintReceipt: boolean;
  autoOpenDrawerOnCash: boolean;
}

// Backup local automático (Sprint 15) — cópia periódica do easypdv.db,
// nenhum envio pra nuvem/Intermediador nesta rodada. Ver apps/electron/src/main/backup.ts.
export interface BackupInfo {
  fileName: string;
  createdAt: string;
  sizeBytes: number;
}
