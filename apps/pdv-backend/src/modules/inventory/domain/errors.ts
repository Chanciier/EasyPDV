import { DomainError, type DomainErrorKind } from "../../../common/domain-error.js";

export class WarehouseNotFoundError extends DomainError {
  readonly kind: DomainErrorKind = "not_found";
  constructor(id: string) {
    super(`Depósito ${id} não encontrado`);
  }
}
