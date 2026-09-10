import { DomainError } from "../../../common/domain-error.js";

/** Espelha InsufficientStoreCreditError do Intermediador — HttpStoreCreditGateway traduz o 409 pra isso. */
export class InsufficientStoreCreditError extends DomainError {
  readonly kind = "conflict";
  constructor(document: string) {
    super(`Saldo de vale-troca insuficiente para o CPF ${document}.`);
  }
}
