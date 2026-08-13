import type {
  CashMovementType,
  CashSessionStatus,
  FiscalDocumentStatus,
  FiscalDocumentType,
  PaymentMethod,
  PaymentStatus,
  SaleStatus,
  StockMovementType,
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
  storeId: string;
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
