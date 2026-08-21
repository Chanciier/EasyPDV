import type { ReceiptPrintPayload } from "@easypdv/shared-types";
import { ESC_POS, qrCode, separator, text, twoColumns } from "./escpos.js";

const WIDTH = 42;

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Pagamento dividido (2026-08-21) — uma linha por perna aprovada, reaproveitado por buildReceipt e buildFiscalReceipt. */
function pushPaymentLines(chunks: Buffer[], payments: ReceiptPrintPayload["payments"]): void {
  for (const payment of payments) {
    chunks.push(twoColumns(payment.label, formatBRL(payment.amount), WIDTH));
    if (payment.received !== undefined) {
      chunks.push(twoColumns("  Recebido", formatBRL(payment.received), WIDTH));
    }
    if (payment.change !== undefined && payment.change > 0) {
      chunks.push(twoColumns("  Troco", formatBRL(payment.change), WIDTH));
    }
  }
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
  pushPaymentLines(chunks, payload.payments);
  if (payload.customerDocument) {
    chunks.push(text(`CPF: ${payload.customerDocument}`));
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

/** Grupos de 4 dígitos — só legibilidade, a chave de acesso em si não muda. */
function formatAccessKey(accessKey: string): string {
  return (accessKey.match(/.{1,4}/g) ?? [accessKey]).join(" ");
}

/**
 * Cupom fiscal (NFC-e) — chamado só manualmente pelo Histórico quando o
 * documento fiscal já foi emitido (`payload.fiscal` presente), nunca no
 * fluxo automático de confirmação de venda (esse continua sempre não-fiscal
 * via buildReceipt — decisão já travada do projeto: "cliente sempre sai com
 * papel na hora, o documento fiscal de verdade pode chegar em seguida").
 */
export function buildFiscalReceipt(payload: ReceiptPrintPayload): Buffer {
  if (!payload.fiscal) {
    throw new Error("buildFiscalReceipt chamado sem payload.fiscal — use buildReceipt para o comprovante não fiscal.");
  }
  const { documentNumber, accessKey, qrCodeUrl } = payload.fiscal;

  const chunks: Buffer[] = [ESC_POS.INIT, ESC_POS.ALIGN_CENTER, ESC_POS.BOLD_ON];
  chunks.push(text(payload.storeName ?? "EasyPDV"));
  chunks.push(ESC_POS.BOLD_OFF);
  chunks.push(text("NFC-e - Nota Fiscal de Consumidor Eletronica"));
  chunks.push(ESC_POS.ALIGN_LEFT);
  chunks.push(separator(WIDTH));
  chunks.push(text(`Cupom: ${payload.saleId}`));
  chunks.push(text(`NFC-e no ${documentNumber}`));
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
  pushPaymentLines(chunks, payload.payments);
  if (payload.customerDocument) {
    chunks.push(text(`CPF: ${payload.customerDocument}`));
  }

  chunks.push(separator(WIDTH));
  chunks.push(text("Consulte pela Chave de Acesso no site"));
  chunks.push(text("da SEFAZ do seu estado, ou pelo QR Code:"));
  chunks.push(text(formatAccessKey(accessKey)));
  chunks.push(ESC_POS.ALIGN_CENTER);
  chunks.push(qrCode(qrCodeUrl));
  chunks.push(ESC_POS.ALIGN_LEFT);

  chunks.push(text(""));
  chunks.push(text(""));
  chunks.push(text(""));
  chunks.push(ESC_POS.CUT_PARTIAL);

  return Buffer.concat(chunks);
}
