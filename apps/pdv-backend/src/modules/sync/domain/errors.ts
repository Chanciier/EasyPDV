import { DomainError } from "../../../common/domain-error.js";

export class SyncOutboxEntryNotFoundError extends DomainError {
  readonly kind = "not_found";
  constructor(id: string) {
    super(`Entrada de sync ${id} não encontrada`);
  }
}

export class SyncOutboxEntryNotRetryableError extends DomainError {
  readonly kind = "conflict";
  constructor(id: string, status: string) {
    super(`Entrada de sync ${id} está "${status}" — só entradas "failed" podem ser retentadas manualmente`);
  }
}
