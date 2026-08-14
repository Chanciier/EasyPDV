import { DomainError } from "../../../common/domain-error.js";

export class SyncJobNotFoundError extends DomainError {
  readonly kind = "not_found";
  constructor(id: string) {
    super(`SyncJob ${id} não encontrado`);
  }
}
