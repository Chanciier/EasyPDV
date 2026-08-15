import { DomainError } from "../../../common/domain-error.js";

export class OrganizationNotFoundError extends DomainError {
  readonly kind = "not_found";
  constructor(id: string) {
    super(`Organização ${id} não encontrada`);
  }
}

export class StoreNotFoundError extends DomainError {
  readonly kind = "not_found";
  constructor(id: string) {
    super(`Loja ${id} não encontrada`);
  }
}

export class ActivationCodeInvalidError extends DomainError {
  readonly kind = "not_found";
  constructor() {
    super("Código de ativação inválido");
  }
}

export class ActivationCodeExpiredError extends DomainError {
  readonly kind = "conflict";
  constructor() {
    super("Código de ativação expirado");
  }
}

export class ActivationCodeAlreadyUsedError extends DomainError {
  readonly kind = "conflict";
  constructor() {
    super("Código de ativação já foi usado");
  }
}

export class InvalidTerminalApiKeyError extends DomainError {
  readonly kind = "unauthorized";
  constructor() {
    super("Chave de API de terminal inválida");
  }
}
