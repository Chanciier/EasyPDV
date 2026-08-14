export interface SyncGatewayEntry {
  entityType: string;
  entityId: string;
  payload: unknown;
}

/**
 * Fala com o Intermediador via HTTP. Implementação real usa fetch contra
 * INTERMEDIADOR_URL; falha de rede aqui nunca afeta a venda — ela já foi
 * gravada localmente antes desta entrada existir. Ver docs/ERROR-HANDLING.md.
 */
export interface SyncGatewayPort {
  send(entry: SyncGatewayEntry): Promise<void>;
}

export const SYNC_GATEWAY = Symbol("SYNC_GATEWAY");
