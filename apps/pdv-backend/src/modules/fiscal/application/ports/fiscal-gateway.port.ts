import type { FiscalStatusPayload } from "@easypdv/shared-types";

/**
 * `null` é resposta válida (Intermediador confirmou que não existe documento
 * fiscal pra essa venda — ex: emissão de NFC-e desligada, ou venda ainda não
 * sincronizou). Lançar exceção é reservado pra falha de rede/inesperada —
 * ver HttpFiscalGateway e GetFiscalStatusUseCase (cai pro cache local nesse caso).
 */
export interface FiscalGatewayPort {
  fetchStatus(saleId: string): Promise<FiscalStatusPayload | null>;
}

export const FISCAL_GATEWAY = Symbol("FISCAL_GATEWAY");
