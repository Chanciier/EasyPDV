import { DomainError } from "../../../common/domain-error.js";

/**
 * Saldo insuficiente pro resgate — decrement atômico já garante que isso
 * nunca deixa o saldo negativo (ver StoreCreditRepositoryPort.redeem), este
 * erro é só a tradução de "operação de negócio recusada" pro chamador.
 */
export class InsufficientStoreCreditError extends DomainError {
  readonly kind = "conflict";
  constructor(document: string) {
    super(`Saldo de vale-troca insuficiente para o CPF ${document}.`);
  }
}

/** Mesma regra de ItemDiscountExceedsLineTotalError (pdv-backend/sales) — nunca confia no cliente, sempre confere no backend. */
export class StoreCreditItemDiscountExceedsLineTotalError extends DomainError {
  readonly kind = "conflict";
  constructor(productSku: string, discountAmount: number, lineTotal: number) {
    super(`Desconto de ${discountAmount} no item ${productSku} excede o valor da linha (${lineTotal}).`);
  }
}
