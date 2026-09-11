import { DomainError } from "../../../common/domain-error.js";

export class CustomerNotFoundError extends DomainError {
  readonly kind = "not_found";
  constructor(id: string) {
    super(`Cliente ${id} não encontrado`);
  }
}

/** Espelha DocumentAlreadyInUseError do pdv-backend — mesma regra, agora escopada por organização em vez de por terminal. */
export class DocumentAlreadyInUseError extends DomainError {
  readonly kind = "conflict";
  constructor(document: string) {
    super(`Já existe um cliente com o documento ${document}`);
  }
}
