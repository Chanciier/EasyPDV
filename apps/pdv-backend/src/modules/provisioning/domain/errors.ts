import { DomainError } from "../../../common/domain-error.js";

export class AlreadyActivatedError extends DomainError {
  readonly kind = "conflict";
  constructor() {
    super("Este terminal já foi ativado");
  }
}

export class ActivationFailedError extends DomainError {
  readonly kind = "conflict";
  constructor(reason: string) {
    super(`Falha ao ativar terminal: ${reason}`);
  }
}
