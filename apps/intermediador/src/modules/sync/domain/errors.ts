import { DomainError } from "../../../common/domain-error.js";

export class SyncJobNotFoundError extends DomainError {
  readonly kind = "not_found";
  constructor(id: string) {
    super(`SyncJob ${id} não encontrado`);
  }
}

export class SyncJobNotRetryableError extends DomainError {
  readonly kind = "conflict";
  constructor(id: string, status: string) {
    super(`SyncJob ${id} está "${status}" — só jobs "failed" podem ser retentados manualmente`);
  }
}
