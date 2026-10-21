export interface StoreCreditGrantItemInput {
  productSku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  restock: boolean;
}

export interface StoreCreditBalanceRow {
  customerCpf: string;
  customerName: string | null;
  customerPhone: string | null;
  balance: number;
  updatedAt: string;
}

export interface GrantStoreCreditInput {
  document: string;
  customerName?: string;
  customerPhone?: string;
  items: StoreCreditGrantItemInput[];
}

export interface StoreCreditGrantResult {
  grantId: string;
  totalAmount: number;
  balance: number;
}

export interface RedeemStoreCreditInput {
  document: string;
  amount: number;
  saleReference?: string;
}

export interface AdjustStoreCreditInput {
  document: string;
  amount: number;
  reason: string;
  actorUserId: string | null;
}

/** Mesmo desenho de ClubGatewayPort — porta pro saldo de Vale-Troca, central no Intermediador. */
export interface StoreCreditGatewayPort {
  /** `null` = não deu pra saber (rede/identidade indisponível) — chamador trata como "sem saldo visível", nunca bloqueia a venda por isso. */
  getBalance(document: string): Promise<number | null>;
  /** Clientes com saldo > 0. Lança se o Intermediador não responder (ex.: versão sem a rota) — a tela mostra o erro. */
  listBalances(query?: string): Promise<StoreCreditBalanceRow[]>;
  grant(input: GrantStoreCreditInput): Promise<StoreCreditGrantResult>;
  /** Lança se o Intermediador recusar (saldo insuficiente, HTTP 409) — chamador precisa tratar. */
  redeem(input: RedeemStoreCreditInput): Promise<{ balance: number }>;
  /** Ajuste manual (tela Clientes) — mesma semântica de erro de `redeem` (lança se saldo ficaria negativo). */
  adjust(input: AdjustStoreCreditInput): Promise<{ balance: number }>;
}

export const STORE_CREDIT_GATEWAY = Symbol("STORE_CREDIT_GATEWAY");
