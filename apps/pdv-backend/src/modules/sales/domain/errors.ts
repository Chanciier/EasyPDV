import { DomainError, type DomainErrorKind } from "../../../common/domain-error.js";

export class CashRegisterNotFoundError extends DomainError {
  readonly kind: DomainErrorKind = "not_found";
  constructor(id: string) {
    super(`Caixa ${id} não encontrado`);
  }
}

export class CashRegisterAlreadyOpenError extends DomainError {
  readonly kind: DomainErrorKind = "conflict";
  constructor(id: string) {
    super(`Já existe uma sessão aberta para o caixa ${id}`);
  }
}

export class CashSessionNotFoundError extends DomainError {
  readonly kind: DomainErrorKind = "not_found";
  constructor(id: string) {
    super(`Sessão de caixa ${id} não encontrada`);
  }
}

export class CashSessionNotOpenError extends DomainError {
  readonly kind: DomainErrorKind = "conflict";
  constructor(id: string) {
    super(`Sessão de caixa ${id} não está aberta`);
  }
}

export class SaleNotFoundError extends DomainError {
  readonly kind: DomainErrorKind = "not_found";
  constructor(id: string) {
    super(`Venda ${id} não encontrada`);
  }
}

export class SaleNotEditableError extends DomainError {
  readonly kind: DomainErrorKind = "conflict";
  constructor(id: string) {
    super(`Venda ${id} não pode mais ser alterada (não está em rascunho)`);
  }
}

export class SaleItemNotFoundError extends DomainError {
  readonly kind: DomainErrorKind = "not_found";
  constructor(id: string) {
    super(`Item ${id} não encontrado na venda`);
  }
}

export class SaleHasNoItemsError extends DomainError {
  readonly kind: DomainErrorKind = "conflict";
  constructor(id: string) {
    super(`Venda ${id} não tem itens — não pode ser confirmada`);
  }
}

export class InsufficientPaymentError extends DomainError {
  readonly kind: DomainErrorKind = "conflict";
  constructor(id: string, paid: number, total: number) {
    super(`Venda ${id} tem pagamento insuficiente: pago ${paid}, total ${total}`);
  }
}

export class NoWarehouseAvailableError extends DomainError {
  readonly kind: DomainErrorKind = "not_found";
  constructor() {
    super("Nenhum depósito cadastrado para debitar o estoque da venda");
  }
}
