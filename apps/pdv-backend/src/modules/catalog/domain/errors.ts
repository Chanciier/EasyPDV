import { DomainError, type DomainErrorKind } from "../../../common/domain-error.js";

export class SkuAlreadyInUseError extends DomainError {
  readonly kind: DomainErrorKind = "conflict";
  constructor(sku: string) {
    super(`Já existe um produto com o SKU ${sku}`);
  }
}

export class BarcodeAlreadyInUseError extends DomainError {
  readonly kind: DomainErrorKind = "conflict";
  constructor(code: string) {
    super(`Já existe um produto com o código de barras ${code}`);
  }
}

export class ProductNotFoundError extends DomainError {
  readonly kind: DomainErrorKind = "not_found";
  constructor(id: string) {
    super(`Produto ${id} não encontrado`);
  }
}

export class CategoryNotFoundError extends DomainError {
  readonly kind: DomainErrorKind = "not_found";
  constructor(id: string) {
    super(`Categoria ${id} não encontrada`);
  }
}

export class PriceListNotFoundError extends DomainError {
  readonly kind: DomainErrorKind = "not_found";
  constructor(id: string) {
    super(`Tabela de preço ${id} não encontrada`);
  }
}

export class NoActivePriceListError extends DomainError {
  readonly kind: DomainErrorKind = "not_found";
  constructor() {
    super("Nenhuma tabela de preço ativa configurada");
  }
}

export class PriceNotSetError extends DomainError {
  readonly kind: DomainErrorKind = "not_found";
  constructor(productId: string) {
    super(`Produto ${productId} não tem preço definido na tabela ativa`);
  }
}
