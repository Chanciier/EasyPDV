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

/** Pagamento dividido (2026-08-21) — cada pagamento é registrado na hora (ver register-payment.use-case.ts), então precisa de guarda-corrimão contra ultrapassar o restante em qualquer perna individual. */
export class PaymentExceedsRemainingAmountError extends DomainError {
  readonly kind: DomainErrorKind = "conflict";
  constructor(id: string, amount: number, remaining: number) {
    super(`Pagamento de ${amount} excede o restante a pagar (${remaining}) da venda ${id}`);
  }
}

export class NoWarehouseAvailableError extends DomainError {
  readonly kind: DomainErrorKind = "not_found";
  constructor() {
    super("Nenhum depósito cadastrado para debitar o estoque da venda");
  }
}

export class DiscountExceedsSaleTotalError extends DomainError {
  readonly kind: DomainErrorKind = "conflict";
  constructor(id: string, discountAmount: number, subtotal: number) {
    super(`Desconto ${discountAmount} excede o subtotal ${subtotal} da venda ${id}`);
  }
}

export class SaleNotVoidableError extends DomainError {
  readonly kind: DomainErrorKind = "conflict";
  constructor(id: string) {
    super(`Venda ${id} não pode ser estornada (não está confirmada)`);
  }
}

// Guarda-corrimão deliberado, não opcional (Sprint 14): uma NFC-e já emitida
// é uma ação fiscal real perante a SEFAZ — o sistema não permite estornar
// localmente uma venda cujo documento fiscal já saiu. Ver docs/DATABASE.md.
export class SaleHasIssuedFiscalDocumentError extends DomainError {
  readonly kind: DomainErrorKind = "conflict";
  constructor(id: string) {
    super(`Venda ${id} já tem um documento fiscal emitido — não pode ser estornada localmente`);
  }
}

export class SaleWarehouseNotResolvableError extends DomainError {
  readonly kind: DomainErrorKind = "conflict";
  constructor(id: string) {
    super(`Não foi possível determinar o depósito original da venda ${id} para o estorno de estoque`);
  }
}

/**
 * Pedido direto do usuário (2026-08-19): "não posso ter 5 produtos
 * cadastrados e no fim acabar tendo 6 vendidos". Até aqui nada verificava
 * estoque disponível nem em AddSaleItemUseCase (feedback cedo) nem em
 * confirm() (garantia final) — uma venda podia deixar `StockItem.quantity`
 * negativo sem erro nenhum. Lançado nos dois pontos, com a mesma mensagem.
 */
export class InsufficientStockError extends DomainError {
  readonly kind: DomainErrorKind = "conflict";
  constructor(productId: string, available: number, requested: number) {
    super(`Estoque insuficiente para o produto ${productId}: disponível ${available}, solicitado ${requested}`);
  }
}
