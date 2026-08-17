import { DomainError, type DomainErrorKind } from "../../../common/domain-error.js";

export class CustomerNotFoundError extends DomainError {
  readonly kind: DomainErrorKind = "not_found";
  constructor(id: string) {
    super(`Cliente ${id} não encontrado`);
  }
}
