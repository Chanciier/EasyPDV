import { DomainError } from "../../../common/domain-error.js";

export class ErpIntegrationNotFoundError extends DomainError {
  readonly kind = "not_found";
  constructor(organizationId: string) {
    super(`Nenhuma integração Bling ativa para a organização ${organizationId}`);
  }
}

export class FiscalDocumentNotFoundError extends DomainError {
  readonly kind = "not_found";
  constructor(saleId: string) {
    super(`Nenhum documento fiscal encontrado pra venda ${saleId}`);
  }
}

/** Emissão manual de NFC-e (Histórico, venda sem CPF) pedida antes do pedido de venda existir no Bling — não deveria acontecer pra uma venda já confirmada, mas o SyncJob original pode ainda estar em retry. */
export class SaleNotSyncedError extends DomainError {
  readonly kind = "conflict";
  constructor(saleId: string) {
    super(`Venda ${saleId} ainda não sincronizou com o Bling — não é possível emitir NFC-e ainda`);
  }
}
