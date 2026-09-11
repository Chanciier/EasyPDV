export interface ImportCustomersFromBlingResult {
  created: number;
  updated: number;
  skipped: number;
  total: number;
}

/**
 * Botão "Sincronizar com Bling" na tela Clientes (2026-09-11) — mirror do
 * botão homônimo em Produtos, mas aqui a escrita acontece inteira no
 * Intermediador (Customer já é central); este port só repassa o gatilho.
 */
export interface CustomerBlingImportGatewayPort {
  importFromBling(): Promise<ImportCustomersFromBlingResult>;
}

export const CUSTOMER_BLING_IMPORT_GATEWAY = Symbol("CUSTOMER_BLING_IMPORT_GATEWAY");
