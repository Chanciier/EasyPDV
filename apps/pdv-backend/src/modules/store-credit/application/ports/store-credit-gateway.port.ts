export interface StoreCreditGrantItemInput {
  productSku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  restock: boolean;
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

/** Mesmo desenho de ClubGatewayPort — porta pro saldo de Vale-Troca, central no Intermediador. */
export interface StoreCreditGatewayPort {
  /** `null` = não deu pra saber (rede/identidade indisponível) — chamador trata como "sem saldo visível", nunca bloqueia a venda por isso. */
  getBalance(document: string): Promise<number | null>;
  grant(input: GrantStoreCreditInput): Promise<StoreCreditGrantResult>;
  /** Lança se o Intermediador recusar (saldo insuficiente, HTTP 409) — chamador precisa tratar. */
  redeem(input: RedeemStoreCreditInput): Promise<{ balance: number }>;
}

export const STORE_CREDIT_GATEWAY = Symbol("STORE_CREDIT_GATEWAY");
