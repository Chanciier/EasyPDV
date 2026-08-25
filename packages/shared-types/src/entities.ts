import type {
  CashMovementType,
  CashSessionStatus,
  FiscalDocumentStatus,
  FiscalDocumentType,
  PaymentCardBrand,
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
  employeeCode: number;
  /** Troca/reset de senha (2026-08-21) — true força a tela de troca antes de liberar o resto do app. */
  mustChangePassword: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

/**
 * Usuário canônico no Intermediador (Postgres, por organização) — login único
 * entre terminais (2026-08-21). Contrato de fio entre `OrgUsersController`
 * (Intermediador) e `HttpUserVerificationGateway` (pdv-backend); nunca
 * inclui passwordHash. Cada terminal continua tendo seu próprio `User`
 * (SQLite) como espelho/cache — este tipo é só o que trafega entre os dois.
 */
export interface OrgUserPayload {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  employeeCode: number;
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
  // Bandeira do cartão (2026-08-21) — só preenchido junto de cardType, bate
  // com as formas de pagamento reais configuradas no Bling.
  cardBrand: PaymentCardBrand | null;
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

/** Clube Saldão — vem sempre do Bling via Intermediador, nunca do `Customer` local (fontes de verdade separadas de propósito). */
export interface ClubMember {
  document: string;
  name: string;
  validUntil: string | null;
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
  cardBrand: PaymentCardBrand | null;
  installments: number | null;
}

export interface SaleSyncPayload {
  saleId: string;
  totalAmount: number;
  confirmedAt: string;
  items: SaleSyncPayloadItem[];
  payments: SaleSyncPayloadPayment[];
  /**
   * CPF do cliente ("CPF na nota", 2026-08-19) — null pra venda anônima
   * (comportamento de sempre, contato "Consumidor Final" compartilhado no
   * Bling). Quando presente, o Adapter Bling resolve/cria um contato
   * DEDICADO a esse CPF em vez do contato padrão, pra a NFC-e sair no nome
   * do cliente. Ver `BlingSyncTargetAdapter.resolveContactByCpf`.
   */
  customerDocument: string | null;
  customerName: string | null;
}

/**
 * Contrato do payload de SyncOutbox/SyncJob quando entityType="sale_void"
 * (2026-08-19) — gravado por `PrismaSaleRepository.voidConfirmed()`, repõe
 * no Bling o estoque baixado quando a venda original sincronizou. Sem isso,
 * o poll incremental Bling→PDV (que trata o Bling como fonte da verdade de
 * estoque) reverte silenciosamente a devolução de estoque feita localmente
 * pelo estorno, assim que rodar de novo.
 */
export interface SaleVoidSyncPayload {
  saleId: string;
  items: SaleSyncPayloadItem[];
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

// Resposta de POST /provisioning/activation-codes (pdv-backend, admin-only) —
// repassa o retorno de POST /organizations/:id/activation-codes no
// Intermediador. Usado pela tela Administração (aba "Ativar novo terminal").
export interface ActivationCodeResult {
  code: string;
  expiresAt: string;
  storeId: string;
  storeName: string;
}

// Resposta de GET /integrations/bling/products no Intermediador — usado pelo
// pdv-backend pra importar/atualizar o catálogo local a partir do Bling
// (botão manual "Sincronizar com Bling"). `price` vem null quando o Bling não
// retorna preço pro produto (situação incompleta no cadastro de origem).
export interface BlingProductSummary {
  code: string;
  name: string;
  price: number | null;
  /**
   * Saldo de estoque no Bling (`estoque.saldoVirtualTotal`). `null` quando o
   * Bling não devolve o campo pro produto. Adicionado em 2026-08-18: até
   * então o sync trazia só SKU/nome/preço, e o PDV nascia com estoque ZERO
   * pra todo produto importado — a primeira venda real de um produto deixava
   * o saldo local negativo (-1) enquanto o Bling mostrava 1.
   */
  stock: number | null;
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

// GET /sync/status (Sprint 15) — deliberadamente SEM @Roles (diferente de
// GET /sync/outbox, restrito a administrador/gerente/tecnico): é o "modo
// contingência" básico, qualquer operador precisa ver que a sincronização
// está pendente/falhando, não só quem tem acesso à Central de Erros
// detalhada. Só contagem, nunca o payload das entradas.
export interface SyncStatusSummary {
  pendingCount: number;
  failedCount: number;
}
