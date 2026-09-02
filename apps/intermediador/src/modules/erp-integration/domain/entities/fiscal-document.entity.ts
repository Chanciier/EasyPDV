import type { ErpProviderCode } from "./erp-integration.entity.js";

export type FiscalDocumentTypeCode = "nfce" | "comprovante_nao_fiscal";
export type FiscalDocumentStatusCode = "pending" | "issued" | "cancelled" | "error";

export interface FiscalDocumentProps {
  id: string;
  organizationId: string;
  provider: ErpProviderCode;
  saleId: string;
  type: FiscalDocumentTypeCode;
  status: FiscalDocumentStatusCode;
  externalId: string;
  externalStatus: number | null;
  documentNumber: string | null;
  accessKey: string | null;
  danfeUrl: string | null;
  qrCodeUrl: string | null;
  errorMessage: string | null;
  retryCount: number;
  issuedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class FiscalDocument {
  readonly id: string;
  readonly organizationId: string;
  readonly provider: ErpProviderCode;
  readonly saleId: string;
  readonly type: FiscalDocumentTypeCode;
  readonly status: FiscalDocumentStatusCode;
  readonly externalId: string;
  readonly externalStatus: number | null;
  readonly documentNumber: string | null;
  readonly accessKey: string | null;
  readonly danfeUrl: string | null;
  readonly qrCodeUrl: string | null;
  readonly errorMessage: string | null;
  readonly retryCount: number;
  readonly issuedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: FiscalDocumentProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.provider = props.provider;
    this.saleId = props.saleId;
    this.type = props.type;
    this.status = props.status;
    this.externalId = props.externalId;
    this.externalStatus = props.externalStatus;
    this.documentNumber = props.documentNumber;
    this.accessKey = props.accessKey;
    this.danfeUrl = props.danfeUrl;
    this.qrCodeUrl = props.qrCodeUrl;
    this.errorMessage = props.errorMessage;
    this.retryCount = props.retryCount;
    this.issuedAt = props.issuedAt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}
