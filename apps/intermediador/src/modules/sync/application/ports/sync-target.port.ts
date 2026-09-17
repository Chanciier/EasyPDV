export interface SyncTargetInput {
  entityType: string;
  entityId: string;
  payload: unknown;
}

/**
 * Fala com o ERP de verdade (Bling na V1) — porta abstrata, "Bling é só um
 * Adapter" (ver docs/ARCHITECTURE.md). Implementada por BlingSyncTargetAdapter.
 */
export interface SyncTargetPort {
  process(input: SyncTargetInput): Promise<void>;
}

export const SYNC_TARGET = Symbol("SYNC_TARGET");
