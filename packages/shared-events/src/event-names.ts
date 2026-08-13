/**
 * Nomes de evento do sistema — sempre no passado (algo que já aconteceu).
 * Ver Claude/Projetos/EasyPDV/Modelo de Domínio.md no cofre Obsidian para quando cada um dispara.
 */
export const EventName = {
  // Identity
  USER_LOGGED_IN: "UserLoggedIn",
  USER_LOGGED_OUT: "UserLoggedOut",
  USER_CREATED: "UserCreated",
  ROLE_ASSIGNED: "RoleAssigned",

  // Catalog
  PRODUCT_CREATED: "ProductCreated",
  PRODUCT_UPDATED: "ProductUpdated",
  PRICE_CHANGED: "PriceChanged",

  // Inventory
  STOCK_ADJUSTED: "StockAdjusted",
  STOCK_DEBITED: "StockDebited",

  // Sales
  CASH_OPENED: "CashOpened",
  CASH_CLOSED: "CashClosed",
  CASH_MOVEMENT_REGISTERED: "CashMovementRegistered",
  SALE_STARTED: "SaleStarted",
  SALE_ITEM_ADDED: "SaleItemAdded",
  PAYMENT_REGISTERED: "PaymentRegistered",
  SALE_CONFIRMED: "SaleConfirmed",
  SALE_CANCELLED: "SaleCancelled",

  // Fiscal
  FISCAL_DOCUMENT_REQUESTED: "FiscalDocumentRequested",
  FISCAL_DOCUMENT_ISSUED: "FiscalDocumentIssued",
  FISCAL_DOCUMENT_FAILED: "FiscalDocumentFailed",

  // Sync (PDV local -> Intermediador)
  SYNC_REQUESTED: "SyncRequested",
  SYNC_SUCCEEDED: "SyncSucceeded",
  SYNC_FAILED: "SyncFailed",
} as const;

export type EventName = (typeof EventName)[keyof typeof EventName];
