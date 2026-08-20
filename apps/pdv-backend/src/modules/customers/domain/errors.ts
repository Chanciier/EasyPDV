import { DomainError, type DomainErrorKind } from "../../../common/domain-error.js";

export class CustomerNotFoundError extends DomainError {
  readonly kind: DomainErrorKind = "not_found";
  constructor(id: string) {
    super(`Cliente ${id} não encontrado`);
  }
}

/**
 * Achado real (2026-08-20): `Customer.document` ganhou `@unique` pro fluxo
 * "CPF na nota" — sem esse erro tratado, criar um cliente com documento
 * repetido derrubava a constraint do banco direto num 500 genérico em vez
 * de uma resposta clara.
 */
export class DocumentAlreadyInUseError extends DomainError {
  readonly kind: DomainErrorKind = "conflict";
  constructor(document: string) {
    super(`Já existe um cliente com o documento ${document}`);
  }
}
