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

/**
 * `toLocaleString("pt-BR", {style:"currency",...})` (formatBRL) insere um
 * espaço não separável (U+00A0) depois de "R$", não um espaço ASCII comum —
 * achado em campo (2026-08-25): esse byte (0xA0) cru na impressora vira "á"
 * na code page CP850 (padrão em térmicas brasileiras), imprimindo "R$á429,99"
 * em vez de "R$ 429,99". `Buffer.from(str, "ascii")` só usa o byte baixo de
 * cada char, não troca por "?" nem falha — silenciosamente manda o 0xA0 cru.
 */
const UNICODE_SPACE_CODEPOINTS = new Set([
  0x00a0, // non-breaking space
  0x2007, // figure space
  0x202f, // narrow no-break space
  0x2060, // word joiner
  0xfeff, // zero-width no-break space (BOM)
]);

function normalizeSpaces(value: string): string {
  return Array.from(value)
    .map((char) => (UNICODE_SPACE_CODEPOINTS.has(char.codePointAt(0) ?? 0) ? " " : char))
    .join("");
}

export function text(line: string): Buffer {
  return Buffer.from(`${stripAccents(normalizeSpaces(line))}\n`, "ascii");
}

export function separator(width = 42, char = "-"): Buffer {
  return text(char.repeat(width));
}

/** Alinha duas strings nas pontas de uma linha de `width` colunas (rótulo à esquerda, valor à direita). */
export function twoColumns(left: string, right: string, width = 42): Buffer {
  const space = Math.max(1, width - left.length - right.length);
  return text(left + " ".repeat(space) + right);
}

const QR_EC_LEVEL = { L: 0x30, M: 0x31, Q: 0x32, H: 0x33 } as const;

/**
 * `GS ( k` — família de comandos ESC/POS pra símbolos 2D (spec Epson),
 * cada sub-função usa o mesmo envelope pL/pH (tamanho de [cn, fn, ...params]
 * em little-endian de 2 bytes) antes do payload.
 */
function gsK(cn: number, fn: number, params: number[]): Buffer {
  const payload = Buffer.from([cn, fn, ...params]);
  const pL = payload.length & 0xff;
  const pH = (payload.length >> 8) & 0xff;
  return Buffer.concat([Buffer.from([GS, 0x28, 0x6b, pL, pH]), payload]);
}

/**
 * Imprime um QR code (modelo 2) com o conteúdo dado — usado pro cupom fiscal
 * (Sprint 14), conteúdo é a URL de consulta da NFC-e já extraída do XML
 * autorizado (ver receipt-formatter.ts). Sequência: seleciona modelo → define
 * tamanho do módulo → nível de correção de erro → grava os dados → imprime.
 */
export function qrCode(data: string, moduleSize = 6, ec: keyof typeof QR_EC_LEVEL = "M"): Buffer {
  const dataBuffer = Buffer.from(data, "utf8");
  return Buffer.concat([
    gsK(0x31, 0x41, [0x32, 0x00]),
    gsK(0x31, 0x43, [moduleSize]),
    gsK(0x31, 0x45, [QR_EC_LEVEL[ec]]),
    gsK(0x31, 0x50, [0x30, ...dataBuffer]),
    gsK(0x31, 0x51, [0x30]),
  ]);
}
