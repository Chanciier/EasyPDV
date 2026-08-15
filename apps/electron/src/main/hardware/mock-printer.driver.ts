import type { PrinterDriver } from "./printer-driver.js";

/**
 * Usado quando nenhuma impressora foi configurada em Settings, ou com
 * EASYPDV_PRINTER_MOCK=1 — loga os bytes em vez de mandar pra um dispositivo
 * de verdade. É o que permite testar a IPC ponta a ponta (Renderer →
 * printer:print → formata recibo → "imprime") sem hardware físico conectado.
 */
export class MockPrinterDriver implements PrinterDriver {
  async print(bytes: Buffer): Promise<void> {
    const printable = bytes
      .toString("latin1")
      .split("")
      .map((char) => (char.charCodeAt(0) < 0x20 ? "·" : char))
      .join("");
    console.log(`[MockPrinterDriver] imprimiria ${bytes.length} bytes:\n${printable}`);
  }
}
