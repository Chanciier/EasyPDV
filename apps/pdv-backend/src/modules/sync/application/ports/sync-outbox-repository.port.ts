import type { SyncOutboxEntry, SyncOutboxStatus } from "../../domain/entities/sync-outbox-entry.entity.js";

/**
 * Sem método `create()` de propósito: entradas do outbox são gravadas
 * diretamente pelo PrismaSaleRepository.confirm() na mesma transação do
 * SaleConfirmed (mesmo padrão pragmático do débito de estoque na Sprint 5) —
 * garante atomicidade venda+outbox sem essa porta precisar ser injetada
 * dentro da transação do módulo Sales. Ver docs/DATABASE.md.
 */
export interface SyncOutboxRepositoryPort {
  findMany(params?: { status?: SyncOutboxStatus; limit?: number }): Promise<SyncOutboxEntry[]>;
  markSent(id: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
}

export const SYNC_OUTBOX_REPOSITORY = Symbol("SYNC_OUTBOX_REPOSITORY");
