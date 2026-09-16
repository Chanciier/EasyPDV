export interface StoreCreditGrantItemData {
  productSku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  totalAmount: number;
  restock: boolean;
}

export interface CreateStoreCreditGrantData {
  organizationId: string;
  customerCpf: string;
  customerName: string | null;
  customerPhone: string | null;
  storeId: string | null;
  terminalId: string | null;
  totalAmount: number;
  items: StoreCreditGrantItemData[];
}

export interface StoreCreditGrantResult {
  grantId: string;
  totalAmount: number;
  balance: number;
  items: StoreCreditGrantItemData[];
}

export interface RedeemStoreCreditData {
  organizationId: string;
  customerCpf: string;
  amount: number;
  storeId: string | null;
  terminalId: string | null;
  saleReference: string | null;
}

export interface AdjustStoreCreditData {
  organizationId: string;
  customerCpf: string;
  /** Relativo — positivo soma, negativo subtrai. Nunca zero (validado no schema/use case). */
  amount: number;
  reason: string;
  actorUserId: string | null;
  storeId: string | null;
  terminalId: string | null;
}

/**
 * Porta do saldo de Vale-Troca — projeção (`StoreCreditBalance`) + ledger de
 * auditoria (`StoreCreditGrant`/`StoreCreditRedemption`), mesmo espírito de
 * StockItem/StockMovement no pdv-backend. Ver
 * Planejamento - Vale-Troca (Crédito por CPF).md no cofre Obsidian.
 */
export interface StoreCreditRepositoryPort {
  getBalance(organizationId: string, customerCpf: string): Promise<number>;

  /** Cria o cabeçalho + itens e incrementa a projeção, tudo numa transação. */
  grant(data: CreateStoreCreditGrantData): Promise<StoreCreditGrantResult>;

  /**
   * Decremento atômico condicional (`UPDATE ... WHERE balance >= amount`) —
   * nunca deixa o saldo negativo, mesma técnica do débito de estoque
   * (`{decrement: n}` do Prisma). Retorna `null` quando o saldo disponível
   * no momento da transação é insuficiente (o use case traduz pra
   * InsufficientStoreCreditError) — nunca lança aqui, decisão de negócio
   * fica na camada de aplicação.
   */
  redeem(data: RedeemStoreCreditData): Promise<{ balance: number } | null>;

  /**
   * Ajuste manual (tela Clientes, 2026-09-16) — cria o registro de auditoria
   * (`StoreCreditAdjustment`) + atualiza a projeção, tudo numa transação.
   * `amount` positivo soma sem restrição; negativo usa o MESMO decremento
   * atômico condicional de `redeem` (nunca deixa saldo negativo) — retorna
   * `null` nesse caso quando insuficiente, mesma semântica de `redeem`.
   */
  adjust(data: AdjustStoreCreditData): Promise<{ balance: number } | null>;
}

export const STORE_CREDIT_REPOSITORY = Symbol("STORE_CREDIT_REPOSITORY");
