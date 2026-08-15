/**
 * Trocar de fabricante/mecanismo de impressão não deve tocar em nada fora
 * deste diretório — a IPC (ipc/hardware.ts) só conhece essa interface. Ver
 * docs/ELECTRON.md.
 */
export interface PrinterDriver {
  print(bytes: Buffer): Promise<void>;
}
