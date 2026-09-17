/** Extrai uma mensagem legível de um `unknown` de catch — erro pode não ser `Error`. */
export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
