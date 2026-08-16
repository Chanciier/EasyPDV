import type {
  CashMovementType,
  CashSessionStatus,
  FiscalDocumentStatus,
  FiscalDocumentType,
  PaymentCardType,
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
  // O backend sempre devolve a venda com itens/pagamentos embutidos
  // (GET /sales/:id, GET /sales, POST /sales/:id/*) — refletindo o wire
  // real aqui evita ficar espalhando "any"/cast pelo frontend (Sprint 9).
  items: SaleItem[];
  payments: Payment[];
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
  // Só preenchido quando method="cartao" (V1 sem TEF real — o operador
  // declara se a maquininha rodou como crédito/débito e em quantas parcelas).
  cardType: PaymentCardType | null;
  installments: number | null;
  status: PaymentStatus;
  authorizationCode: string | null;
  createdAt: string;
}

// Espelho local (PDV, SQLite) do FiscalDocument do Intermediador (Sprint 12)
// — consultado sob demanda via GET /fiscal/sale/:saleId no Intermediador
// (nunca fala com o Bling direto), não um push automático. documentNumber/
// danfeUrl/errorMessage vieram além do desenho original do Sprint 0 (só
// accessKey/issuedAt) pela mesma razão de SyncOutboxEntry ter lastError:
// visibilidade de erro é operacionalmente necessária, não cosmética.
export interface FiscalDocument {
  id: string;
  saleId: string;
  type: FiscalDocumentType;
  status: FiscalDocumentStatus;
  documentNumber: string | null;
  accessKey: string | null;
  danfeUrl: string | null;
  // Sprint 14 — a NFC-e autorizada já vem com o QR code pronto embutido no
  // próprio XML (tag <infNFeSupl><qrCode>, padrão nacional gerado pela
  // SEFAZ na autorização). Extraído do XML devolvido pelo Bling, nunca
  // reconstruído na mão a partir de UF+chave (cada estado tem seu próprio
  // host de consulta — montar errado geraria um QR code que não abre a nota
  // certa). Ver BlingApiClient.findNfce.
  qrCodeUrl: string | null;
  errorMessage: string | null;
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

// Provisionamento de terminal (Sprint 10, Intermediador) — ver docs/ELECTRON.md.
// O Electron troca um código de ativação gerado por um Administrador por essa
// identidade; o PDV local persiste o resultado no seu StoreIdentity (SQLite).
export interface TerminalIdentity {
  terminalId: string;
  organizationId: string;
  storeId: string;
  storeName: string;
}

// apiKey só existe uma vez, na resposta de POST /terminals/activate — nunca
// persistida em texto puro no Intermediador (só o hash), e nunca reexibida.
export interface TerminalActivationResult extends TerminalIdentity {
  apiKey: string;
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

// payments[] existe desde a Sprint 14 — antes disso o Adapter Bling nunca
// sabia a forma de pagamento real da venda, usava um único id fixo pra tudo
// (BLING_DEFAULT_PAYMENT_METHOD_ID). V1 sem split de pagamento na prática
// (a tela de Venda só registra um Payment cobrindo o total), mas o payload
// já é um array pra não quebrar se isso mudar.
export interface SaleSyncPayloadPayment {
  method: PaymentMethod;
  amount: number;
  cardType: PaymentCardType | null;
  installments: number | null;
}

export interface SaleSyncPayload {
  saleId: string;
  totalAmount: number;
  confirmedAt: string;
  items: SaleSyncPayloadItem[];
  payments: SaleSyncPayloadPayment[];
}

// Resposta de GET /fiscal/sale/:saleId no Intermediador (Sprint 12) — é o que
// o pdv-backend usa pra espelhar o FiscalDocument local. 404 quando a venda
// ainda não tem NFC-e (emissão é opt-in via BLING_NFCE_AUTO_EMIT, e mesmo
// ligada, a venda pode não ter sincronizado ainda — ver BlingSyncTargetAdapter).
export interface FiscalStatusPayload {
  type: FiscalDocumentType;
  status: FiscalDocumentStatus;
  documentNumber: string | null;
  accessKey: string | null;
  danfeUrl: string | null;
  qrCodeUrl: string | null;
  errorMessage: string | null;
  issuedAt: string | null;
}

// Trilha imutável de eventos sensíveis (Sprint 13) — ver docs/DATABASE.md pra
// a lista de ações auditadas e onde cada uma é escrita. metadata é o payload
// já desserializado (o backend faz JSON.parse antes de devolver na resposta).
export interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

// GET /reports/sales?from=&to= — agregado por dia, sem o cap de 100 registros
// que GET /sales tem (Sprint 13 corrige o Histórico usando isso em vez de
// somar client-side a lista paginada).
export interface SalesReportEntry {
  period: string;
  salesCount: number;
  totalAmount: number;
}

export interface StockReportEntry {
  warehouseId: string;
  productId: string;
  quantity: number;
}

export interface DashboardReport {
  todaySalesCount: number;
  todaySalesTotal: number;
  averageTicket: number;
  openCashSessionsCount: number;
}
