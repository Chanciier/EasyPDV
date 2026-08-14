import type {
  CashMovementType,
  CashSessionStatus,
  FiscalDocumentStatus,
  FiscalDocumentType,
  PaymentMethod,
  PaymentStatus,
  SaleStatus,
  StockMovementType,
  SyncStatus,
  UserRole,
} from "./enums.js";

/**
 * Tipos do domínio local (PDV na loja, banco SQLite).
 * Ver Claude/Projetos/EasyPDV/Modelo de Domínio.md no cofre Obsidian para o desenho completo.
 */

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface Store {
  id: string;
  name: string;
  document: string | null;
  timezone: string;
}

export interface Category {
  id: string;
  name: string;
  parentCategoryId: string | null;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  categoryId: string | null;
  unit: string;
  active: boolean;
}

export interface Barcode {
  id: string;
  productId: string;
  code: string;
  type: string;
}

export interface PriceList {
  id: string;
  name: string;
  active: boolean;
}

export interface PriceListItem {
  id: string;
  priceListId: string;
  productId: string;
  price: number;
  promotionalPrice: number | null;
}

export interface ResolvedPrice {
  productId: string;
  price: number;
  promotionalPrice: number | null;
  effectivePrice: number;
}

export interface Warehouse {
  id: string;
  name: string;
  active: boolean;
}

export interface StockItem {
  warehouseId: string;
  productId: string;
  quantity: number;
  reservedQuantity: number;
}

export interface StockMovement {
  id: string;
  warehouseId: string;
  productId: string;
  type: StockMovementType;
  quantity: number;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: string;
}

export interface CashRegister {
  id: string;
  name: string;
  active: boolean;
}

export interface CashSession {
  id: string;
  cashRegisterId: string;
  operatorUserId: string;
  openedAt: string;
  closedAt: string | null;
  openingAmount: number;
  closingAmount: number | null;
  expectedAmount: number | null;
  status: CashSessionStatus;
}

export interface CashMovement {
  id: string;
  cashSessionId: string;
  type: CashMovementType;
  amount: number;
  reason: string | null;
  authorizedByUserId: string | null;
  createdAt: string;
}

export interface Sale {
  id: string;
  cashSessionId: string;
  operatorUserId: string;
  customerId: string | null;
  status: SaleStatus;
  totalAmount: number;
  discountAmount: number;
  createdAt: string;
  confirmedAt: string | null;
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  totalAmount: number;
}

export interface Payment {
  id: string;
  saleId: string;
  method: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  authorizationCode: string | null;
  createdAt: string;
}

export interface FiscalDocument {
  id: string;
  saleId: string;
  type: FiscalDocumentType;
  status: FiscalDocumentStatus;
  accessKey: string | null;
  issuedAt: string | null;
}

export interface Customer {
  id: string;
  name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
}

// Outbox local (PDV, SQLite) — fila de sincronização com o Intermediador.
export interface SyncOutboxEntry {
  id: string;
  entityType: string;
  entityId: string;
  payload: string;
  status: SyncStatus;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  sentAt: string | null;
}

// Job de sincronização no Intermediador (PostgreSQL) — um por SyncOutboxEntry
// recebido via POST /sync, processado pela fila BullMQ.
export interface SyncJob {
  id: string;
  storeId: string | null;
  entityType: string;
  entityId: string;
  payload: unknown;
  status: SyncStatus;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

// Contrato interno do payload de SyncOutbox/SyncJob quando entityType="sale"
// (Sprint 7) — gravado pelo PrismaSaleRepository.confirm() no PDV local,
// consumido pelo BlingSyncAdapter no Intermediador. sku/name/unitPrice
// existem aqui porque o Intermediador nunca tem acesso ao Catalog local —
// precisa desses dados "achatados" pra resolver o produto no Bling.
export interface SaleSyncPayloadItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface SaleSyncPayload {
  saleId: string;
  totalAmount: number;
  confirmedAt: string;
  items: SaleSyncPayloadItem[];
}
