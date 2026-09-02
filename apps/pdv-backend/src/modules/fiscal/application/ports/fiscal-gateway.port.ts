import type { FiscalStatusPayload } from "@easypdv/shared-types";

/**
 * `null` é resposta válida (Intermediador confirmou que não existe documento
 * fiscal pra essa venda — ex: emissão de NFC-e desligada, ou venda ainda não
 * sincronizou). Lançar exceção é reservado pra falha de rede/inesperada —
 * ver HttpFiscalGateway e GetFiscalStatusUseCase (cai pro cache local nesse caso).
 */
export interface FiscalGatewayPort {
  fetchStatus(saleId: string): Promise<FiscalStatusPayload | null>;
  /** Emissão manual de NFC-e (Histórico, venda sem CPF) — `null` só quando o terminal não tem identidade local (mesmo caso de fetchStatus). Erros de rede/Intermediador propagam (ação explícita do operador, não deve falhar em silêncio). */
  issueManually(saleId: string): Promise<FiscalStatusPayload | null>;
  /** Reenvio manual de NFC-e "error" (botão "Tentar novamente" no Histórico). Mesma semântica de erro/`null` de issueManually. */
  retryManually(saleId: string): Promise<FiscalStatusPayload | null>;
}

export const FISCAL_GATEWAY = Symbol("FISCAL_GATEWAY");
