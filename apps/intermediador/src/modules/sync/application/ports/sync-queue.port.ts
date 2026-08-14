/** Abstrai a fila (BullMQ) — use-cases nunca importam o BullMQ diretamente. */
export interface SyncQueuePort {
  enqueue(syncJobId: string): Promise<void>;
}

export const SYNC_QUEUE = Symbol("SYNC_QUEUE");
