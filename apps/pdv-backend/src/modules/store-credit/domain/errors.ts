import { DomainError } from "../../../common/domain-error.js";

/** Espelha InsufficientStoreCreditError do Intermediador — HttpStoreCreditGateway traduz o 409 pra isso. */
export class InsufficientStoreCreditError extends DomainError {
  readonly kind = "conflict";
  constructor(document: string) {
    super(`Saldo de vale-troca insuficiente para o CPF ${document}.`);
  }
}

/** Espelha StoreCreditItemDiscountExceedsLineTotalError do Intermediador (validação repetida aqui e lá, de propósito — nunca confia no cliente nem num único lado da fronteira HTTP). */
export class StoreCreditItemDiscountExceedsLineTotalError extends DomainError {
  readonly kind = "conflict";
  constructor(productId: string, discountAmount: number, lineTotal: number) {
    super(`Desconto ${discountAmount} excede o subtotal ${lineTotal} do item ${productId}`);
  }
}

/** Mesmo guarda-corrimão de NoWarehouseAvailableError (sales) — espelhado aqui pelo mesmo motivo de não acoplar módulos via import cruzado de domínio (ver docs/MODULES.md). */
export class NoWarehouseAvailableError extends DomainError {
  readonly kind = "not_found";
  constructor() {
    super("Nenhum depósito cadastrado para devolver os itens da troca ao estoque");
  }
}

/** CPF novo (sem Customer local) mas nome/telefone não vieram — o pedido do usuário exige os dois nesse caso, diferente do portão de CPF de uma venda normal (onde são opcionais). */
export class StoreCreditCustomerDataRequiredError extends DomainError {
  readonly kind = "conflict";
  constructor() {
    super("Cliente novo — informe nome e telefone para gerar o crédito de troca.");
  }
}
