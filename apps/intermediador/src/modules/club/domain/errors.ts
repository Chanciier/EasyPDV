import { DomainError } from "../../../common/domain-error.js";

export class ClubTipoContatoNotFoundError extends DomainError {
  readonly kind = "not_found";
  constructor() {
    super('Conta Bling não tem tipo de contato "Clube Saldão" cadastrado.');
  }
}

export class ClubMemberNotFoundError extends DomainError {
  readonly kind = "not_found";
  constructor(document: string) {
    super(`Nenhum contato encontrado no Bling pro CPF ${document}.`);
  }
}
