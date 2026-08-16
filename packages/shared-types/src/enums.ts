export const UserRole = {
  OPERADOR: "operador",
  SUPERVISOR: "supervisor",
  GERENTE: "gerente",
  ADMINISTRADOR: "administrador",
  PROPRIETARIO: "proprietario",
  AUDITOR: "auditor",
  TECNICO: "tecnico",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const SaleStatus = {
  DRAFT: "draft",
  PENDING: "pending",
  CONFIRMED: "confirmed",
  CANCELLED: "cancelled",
} as const;
export type SaleStatus = (typeof SaleStatus)[keyof typeof SaleStatus];

export const PaymentMethod = {
  DINHEIRO: "dinheiro",
  CARTAO: "cartao",
  PIX: "pix",
  OUTRO: "outro",
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

// Só se aplica quando method="cartao" — sem TEF real (ver PaymentMethod),
// é o operador quem declara se a maquininha rodou como crédito ou débito.
export const PaymentCardType = {
  CREDITO: "credito",
  DEBITO: "debito",
} as const;
export type PaymentCardType = (typeof PaymentCardType)[keyof typeof PaymentCardType];

export const PaymentStatus = {
  APROVADO: "aprovado",
  PENDENTE: "pendente",
  RECUSADO: "recusado",
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const CashSessionStatus = {
  OPEN: "open",
  CLOSED: "closed",
  RECONCILED: "reconciled",
} as const;
export type CashSessionStatus = (typeof CashSessionStatus)[keyof typeof CashSessionStatus];

export const CashMovementType = {
  SANGRIA: "sangria",
  SUPRIMENTO: "suprimento",
  AJUSTE: "ajuste",
} as const;
export type CashMovementType = (typeof CashMovementType)[keyof typeof CashMovementType];

export const StockMovementType = {
  ENTRADA: "entrada",
  SAIDA: "saida",
  AJUSTE: "ajuste",
  VENDA: "venda",
  DEVOLUCAO: "devolucao",
} as const;
export type StockMovementType = (typeof StockMovementType)[keyof typeof StockMovementType];

export const SyncStatus = {
  PENDING: "pending",
  PROCESSING: "processing",
  SYNCED: "synced",
  FAILED: "failed",
} as const;
export type SyncStatus = (typeof SyncStatus)[keyof typeof SyncStatus];

export const ErpProvider = {
  BLING: "bling",
  TINY: "tiny",
  OMIE: "omie",
  CONTA_AZUL: "conta_azul",
  PROPRIO: "proprio",
} as const;
export type ErpProvider = (typeof ErpProvider)[keyof typeof ErpProvider];

export const FiscalDocumentType = {
  NFCE: "nfce",
  COMPROVANTE_NAO_FISCAL: "comprovante_nao_fiscal",
} as const;
export type FiscalDocumentType = (typeof FiscalDocumentType)[keyof typeof FiscalDocumentType];

export const FiscalDocumentStatus = {
  PENDING: "pending",
  ISSUED: "issued",
  CANCELLED: "cancelled",
  ERROR: "error",
} as const;
export type FiscalDocumentStatus = (typeof FiscalDocumentStatus)[keyof typeof FiscalDocumentStatus];
