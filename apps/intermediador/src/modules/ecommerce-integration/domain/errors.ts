import { DomainError } from "../../../common/domain-error.js";

export class InvalidEcommerceApiKeyError extends DomainError {
  readonly kind = "unauthorized";
  constructor() {
    super("Chave de API do e-commerce inválida");
  }
}
