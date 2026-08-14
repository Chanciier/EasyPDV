export interface SyncTargetInput {
  entityType: string;
  entityId: string;
  payload: unknown;
}

/**
 * Fala com o ERP de verdade (Bling na V1) — porta abstrata, "Bling é só um
 * Adapter" (ver docs/ARCHITECTURE.md). Sprint 6 só tem o NoopSyncTargetAdapter
 * (infrastructure/adapters/noop/); o Adapter Bling entra na Sprint 7
 * implementando esta mesma porta, sem tocar no processor nem nos use-cases.
 */
export interface SyncTargetPort {
  process(input: SyncTargetInput): Promise<void>;
}

export const SYNC_TARGET = Symbol("SYNC_TARGET");
