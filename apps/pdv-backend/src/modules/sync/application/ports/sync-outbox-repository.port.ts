import type { SyncOutboxEntry, SyncOutboxStatus } from "../../domain/entities/sync-outbox-entry.entity.js";

/**
 * Sem método `create()` de propósito: entradas do outbox são gravadas
 * diretamente pelo PrismaSaleRepository.confirm() na mesma transação do
 * SaleConfirmed (mesmo padrão pragmático do débito de estoque na Sprint 5) —
 * garante atomicidade venda+outbox sem essa porta precisar ser injetada
 * dentro da transação do módulo Sales. Ver docs/DATABASE.md.
 */
export interface SyncOutboxRepositoryPort {
  findById(id: string): Promise<SyncOutboxEntry | null>;
  findMany(params?: { status?: SyncOutboxStatus; limit?: number }): Promise<SyncOutboxEntry[]>;
  markSent(id: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
  /**
   * Retry manual (Central de Erros, Sprint 8): zera attempts e volta pra
   * "pending". UPDATE condicional (só aplica se status atual for "failed")
   * pra ficar consistente com o mesmo padrão do lado Intermediador — aqui
   * a corrida é bem menos grave (sem fila, o worker só processa uma vez por
   * tick), mas não custa nada fechar do mesmo jeito. Retorna false se o
   * status não estava mais "failed".
   */
  resetToPending(id: string): Promise<boolean>;
}

export const SYNC_OUTBOX_REPOSITORY = Symbol("SYNC_OUTBOX_REPOSITORY");
