/**
 * Comandos ESC/POS mínimos usados pelo EasyPDV. Padrão Epson ESC/POS,
 * implementado pela maioria das térmicas de cupom vendidas no Brasil
 * (incluindo a impressora de referência, Elgin L42 Pro Full — ver
 * docs/ELECTRON.md). Testado de verdade via WinSpool nesta sprint contra
 * essa impressora cadastrada no Windows (job aceito e enfileirado); a
 * confirmação física (papel saindo, corte, pulso da gaveta) depende do
 * usuário conectar o hardware.
 */

const ESC = 0x1b;
const GS = 0x1d;

export const ESC_POS = {
  INIT: Buffer.from([ESC, 0x40]),
  ALIGN_LEFT: Buffer.from([ESC, 0x61, 0x00]),
  ALIGN_CENTER: Buffer.from([ESC, 0x61, 0x01]),
  BOLD_ON: Buffer.from([ESC, 0x45, 0x01]),
  BOLD_OFF: Buffer.from([ESC, 0x45, 0x00]),
  /** Corte parcial com avanço de papel — GS V 66 0. */
  CUT_PARTIAL: Buffer.from([GS, 0x56, 0x42, 0x00]),
  /**
   * Pulso no pino 2 do conector RJ11/RJ12 da impressora (padrão mais comum
   * de ligação da gaveta em térmicas com kick-out integrado, como a Elgin
   * L42 Pro Full) — ESC p 0 25 250.
   */
  DRAWER_KICK: Buffer.from([ESC, 0x70, 0x00, 0x19, 0xfa]),
};

/**
 * ASCII puro, sem acento — térmicas ESC/POS usam code pages de 1 byte
 * (CP860/CP850/CP1252...) que variam por fabricante/configuração, não UTF-8.
 * Sem uma tabela de conversão por code page (que exigiria saber qual está
 * configurada em cada impressora do cliente), a saída segura que não arrisca
 * caractere ilegível é remover o acento — cupom sai "sem acentuacao" em vez
 * de com símbolo errado.
 */
function stripAccents(value: string): string {
  // Filtra os marcadores de combinação diacrítica (faixa Unicode 0x0300-0x036f)
  // deixados por normalize("NFD") — evitado escrever a faixa como escape \u
  // direto no regex porque ela é decodificada antes de chegar no arquivo.
  return Array.from(value.normalize("NFD"))
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code < 0x0300 || code > 0x036f;
    })
    .join("");
}

export function text(line: string): Buffer {
  return Buffer.from(`${stripAccents(line)}\n`, "ascii");
}

export function separator(width = 42, char = "-"): Buffer {
  return text(char.repeat(width));
}

/** Alinha duas strings nas pontas de uma linha de `width` colunas (rótulo à esquerda, valor à direita). */
export function twoColumns(left: string, right: string, width = 42): Buffer {
  const space = Math.max(1, width - left.length - right.length);
  return text(left + " ".repeat(space) + right);
}
