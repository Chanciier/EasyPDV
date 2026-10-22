import { DomainError, type DomainErrorKind } from "../../../common/domain-error.js";

/*
 * Mensagens (2026-10-22, UX-07/K8): o texto de um DomainError vai direto para
 * a tela do operador — em português, valores em R$ e SEM id interno (cuid),
 * que não diz nada a quem está no caixa. Os construtores continuam recebendo
 * o id (assinaturas iguais para os use cases); quem precisar dele para
 * depuração lê o log/auditoria, não a mensagem.
 */

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Formata em R$ ("R$ 45,90") para mensagens de erro de domínio. */
export function formatBrl(value: number): string {
  return brl.format(value).replace(/ /g, " ");
}

export class CashRegisterNotFoundError extends DomainError {
  readonly kind: DomainErrorKind = "not_found";
  constructor(_id: string) {
    super("Caixa não encontrado.");
  }
}

export class CashRegisterAlreadyOpenError extends DomainError {
  readonly kind: DomainErrorKind = "conflict";
  constructor(_id: string) {
    super("Este caixa já está aberto.");
  }
}

export class CashSessionNotFoundError extends DomainError {
  readonly kind: DomainErrorKind = "not_found";
  constructor(_id: string) {
    super("Sessão de caixa não encontrada.");
  }
}

export class CashSessionNotOpenError extends DomainError {
  readonly kind: DomainErrorKind = "conflict";
  constructor(_id: string) {
    super("Esta sessão de caixa não está mais aberta.");
  }
}

/**
 * Risco #37 (2026-10-22, SEG-09/K7): fechar ou lançar movimento (sangria,
 * suprimento) na sessão aberta por OUTRO operador é ação de gerência — antes
 * a restrição existia só na tela. Ver `canOperateCashSession`.
 */
export class CashSessionNotOwnedError extends DomainError {
  readonly kind: DomainErrorKind = "forbidden";
  constructor() {
    super("Só gerência pode fechar/movimentar o caixa aberto por outro operador.");
  }
}

export class SaleNotFoundError extends DomainError {
  readonly kind: DomainErrorKind = "not_found";
  constructor(_id: string) {
    super("Venda não encontrada.");
  }
}

export class SaleNotEditableError extends DomainError {
  readonly kind: DomainErrorKind = "conflict";
  constructor(_id: string) {
    super("Esta venda não pode mais ser alterada (já foi finalizada ou cancelada).");
  }
}

export class SaleItemNotFoundError extends DomainError {
  readonly kind: DomainErrorKind = "not_found";
  constructor(_id: string) {
    super("Item não encontrado na venda.");
  }
}

export class SaleHasNoItemsError extends DomainError {
  readonly kind: DomainErrorKind = "conflict";
  constructor(_id: string) {
    super("A venda não tem itens — adicione um produto antes de confirmar.");
  }
}

export class InsufficientPaymentError extends DomainError {
  readonly kind: DomainErrorKind = "conflict";
  constructor(_id: string, paid: number, total: number) {
    super(`Pagamento insuficiente: pago ${formatBrl(paid)} de ${formatBrl(total)}.`);
  }
}

/** Pagamento dividido (2026-08-21) — cada pagamento é registrado na hora (ver register-payment.use-case.ts), então precisa de guarda-corrimão contra ultrapassar o restante em qualquer perna individual. */
export class PaymentExceedsRemainingAmountError extends DomainError {
  readonly kind: DomainErrorKind = "conflict";
  constructor(_id: string, amount: number, remaining: number) {
    super(`Pagamento de ${formatBrl(amount)} é maior que o restante a pagar (${formatBrl(remaining)}).`);
  }
}

export class NoWarehouseAvailableError extends DomainError {
  readonly kind: DomainErrorKind = "not_found";
  constructor() {
    super("Nenhum depósito cadastrado para debitar o estoque da venda.");
  }
}

export class DiscountExceedsSaleTotalError extends DomainError {
  readonly kind: DomainErrorKind = "conflict";
  constructor(_id: string, discountAmount: number, subtotal: number) {
    super(`Desconto de ${formatBrl(discountAmount)} é maior que o subtotal da venda (${formatBrl(subtotal)}).`);
  }
}

/** Desconto por item (2026-09-01) — mesmo guarda-corrimão de DiscountExceedsSaleTotalError, escopado à linha do carrinho (quantity * unitPrice), não à venda inteira. */
export class ItemDiscountExceedsLineTotalError extends DomainError {
  readonly kind: DomainErrorKind = "conflict";
  constructor(_itemId: string, discountAmount: number, lineSubtotal: number) {
    super(`Desconto de ${formatBrl(discountAmount)} é maior que o subtotal do item (${formatBrl(lineSubtotal)}).`);
  }
}

/** Clube Saldão (2026-08-25) — desconto manual e de clube são mutuamente exclusivos na mesma venda. */
export class ManualDiscountBlockedByClubError extends DomainError {
  readonly kind: DomainErrorKind = "conflict";
  constructor(_id: string) {
    super("Esta venda já tem desconto de clube — remova o cliente do clube antes de aplicar um desconto manual.");
  }
}

export class ClubDiscountBlockedByManualError extends DomainError {
  readonly kind: DomainErrorKind = "conflict";
  constructor(_id: string) {
    super("Esta venda já tem um desconto manual — remova-o antes do desconto de clube.");
  }
}

export class SaleHasNoCustomerError extends DomainError {
  readonly kind: DomainErrorKind = "conflict";
  constructor(_id: string) {
    super("A venda não tem cliente (CPF) — não é possível checar o clube.");
  }
}

export class SaleNotVoidableError extends DomainError {
  readonly kind: DomainErrorKind = "conflict";
  constructor(_id: string) {
    super("Esta venda não pode ser estornada (não está confirmada).");
  }
}

// Guarda-corrimão deliberado, não opcional (Sprint 14): uma NFC-e já emitida
// é uma ação fiscal real perante a SEFAZ — o sistema não permite estornar
// localmente uma venda cuja NFC-e já saiu. Desde 2026-10-22 (UX-11) só NFC-e
// conta; comprovante não fiscal nunca bloqueia. Ver docs/DATABASE.md.
export class SaleHasIssuedFiscalDocumentError extends DomainError {
  readonly kind: DomainErrorKind = "conflict";
  constructor(_id: string) {
    super("Esta venda já tem NFC-e autorizada — o cancelamento precisa ser feito no Bling, não pelo estorno do caixa.");
  }
}

/**
 * F-2 (2026-10-22, SEG-08): venda com CPF pode ter NFC-e emitida em
 * background pela central sem que este terminal saiba. Se a central não
 * responde, não dá para garantir que não há nota — bloqueia em vez de arriscar.
 */
export class FiscalStatusUnverifiableError extends DomainError {
  readonly kind: DomainErrorKind = "conflict";
  constructor() {
    super("Não foi possível confirmar na central se esta venda (com CPF) tem NFC-e. Tente de novo com internet.");
  }
}

export class SaleWarehouseNotResolvableError extends DomainError {
  readonly kind: DomainErrorKind = "conflict";
  constructor(_id: string) {
    super("Não foi possível descobrir o depósito original da venda para devolver o estoque.");
  }
}

/**
 * Pedido direto do usuário (2026-08-19): "não posso ter 5 produtos
 * cadastrados e no fim acabar tendo 6 vendidos". Hoje sem uso (estoque
 * negativo permitido desde 2026-09-01) — mantido para reverter fácil.
 */
export class InsufficientStockError extends DomainError {
  readonly kind: DomainErrorKind = "conflict";
  constructor(_productId: string, available: number, requested: number) {
    super(`Estoque insuficiente: disponível ${available}, solicitado ${requested}.`);
  }
}

/** Vale-Troca (Fase 3, 2026-09-10) — resgate precisa saber de quem debitar o saldo central. */
export class StoreCreditRedemptionRequiresCustomerError extends DomainError {
  readonly kind: DomainErrorKind = "conflict";
  constructor(_id: string) {
    super("A venda não tem cliente (CPF) — não é possível pagar com Vale-Troca.");
  }
}

/** Espelha InsufficientStoreCreditError do módulo store-credit (mesmo app) — duplicado aqui de propósito, mesma convenção de não acoplar módulos via import cruzado de domínio (ver docs/MODULES.md). */
export class InsufficientStoreCreditError extends DomainError {
  readonly kind: DomainErrorKind = "conflict";
  constructor(_document: string) {
    super("Saldo de Vale-Troca insuficiente para este cliente.");
  }
}
