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
