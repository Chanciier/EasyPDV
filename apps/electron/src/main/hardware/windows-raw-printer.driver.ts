import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { PrinterDriver } from "./printer-driver.js";

const execFileAsync = promisify(execFile);

/**
 * Envia bytes crus (ESC/POS) pro spooler do Windows via resources/print-raw.ps1
 * (P/Invoke de winspool.drv, datatype RAW) — funciona com qualquer impressora
 * cadastrada no Windows que aceite RAW, incluindo a impressora de referência
 * (Elgin L42 Pro Full). Testado de verdade nesta sprint: WritePrinter aceita
 * os bytes e o job aparece na fila real do Windows como "EasyPDV Raw Print"
 * — a impressão física em si (papel/corte/gaveta) só é confirmável quando o
 * hardware estiver conectado, ver docs/ELECTRON.md.
 *
 * ~1-2s de overhead por chamada (o PowerShell recompila o C# inline via
 * Add-Type a cada execução) — aceitável pra impressão de recibo, não é
 * caminho crítico de latência da venda (a venda já foi confirmada antes
 * disso rodar).
 */
export class WindowsRawPrinterDriver implements PrinterDriver {
  constructor(
    private readonly printerName: string,
    private readonly scriptPath: string,
  ) {}

  async print(bytes: Buffer): Promise<void> {
    const tempFile = path.join(os.tmpdir(), `easypdv-print-${Date.now()}-${process.pid}.bin`);
    fs.writeFileSync(tempFile, bytes);
    try {
      const { stdout } = await execFileAsync("powershell.exe", [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        this.scriptPath,
        "-PrinterName",
        this.printerName,
        "-FilePath",
        tempFile,
      ]);
      if (!stdout.includes("OK")) {
        throw new Error(`Impressora "${this.printerName}" respondeu: ${stdout.trim()}`);
      }
    } finally {
      fs.unlinkSync(tempFile);
    }
  }
}
