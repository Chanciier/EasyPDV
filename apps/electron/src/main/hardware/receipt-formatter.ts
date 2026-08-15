import type { ReceiptPrintPayload } from "@easypdv/shared-types";
import { ESC_POS, separator, text, twoColumns } from "./escpos.js";

const WIDTH = 42;

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Monta o cupom não-fiscal completo (init → cabeçalho → itens → totais → corte). */
export function buildReceipt(payload: ReceiptPrintPayload): Buffer {
  const chunks: Buffer[] = [ESC_POS.INIT, ESC_POS.ALIGN_CENTER, ESC_POS.BOLD_ON];
  chunks.push(text(payload.storeName ?? "EasyPDV"));
  chunks.push(ESC_POS.BOLD_OFF);
  chunks.push(text("Comprovante nao fiscal"));
  chunks.push(ESC_POS.ALIGN_LEFT);
  chunks.push(separator(WIDTH));
  chunks.push(text(`Cupom: ${payload.saleId}`));
  chunks.push(text(new Date(payload.confirmedAt).toLocaleString("pt-BR")));
  chunks.push(separator(WIDTH));

  for (const item of payload.items) {
    chunks.push(text(`${item.quantity}x ${item.name}`));
    chunks.push(twoColumns("", formatBRL(item.totalAmount), WIDTH));
  }

  chunks.push(separator(WIDTH));
  chunks.push(ESC_POS.BOLD_ON);
  chunks.push(twoColumns("TOTAL", formatBRL(payload.totalAmount), WIDTH));
  chunks.push(ESC_POS.BOLD_OFF);
  chunks.push(text(payload.paymentLabel));
  if (payload.received !== undefined) {
    chunks.push(twoColumns("Recebido", formatBRL(payload.received), WIDTH));
  }
  if (payload.change !== undefined && payload.change > 0) {
    chunks.push(twoColumns("Troco", formatBRL(payload.change), WIDTH));
  }

  chunks.push(text(""));
  chunks.push(text(""));
  chunks.push(text(""));
  chunks.push(ESC_POS.CUT_PARTIAL);

  return Buffer.concat(chunks);
}

/** Só o pulso da gaveta — usado por "abrir gaveta" manual, sem imprimir nada. */
export function buildDrawerKick(): Buffer {
  return ESC_POS.DRAWER_KICK;
}
