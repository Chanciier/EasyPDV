export type FiscalDocumentTypeCode = "nfce" | "comprovante_nao_fiscal";
export type FiscalDocumentStatusCode = "pending" | "issued" | "cancelled" | "error";

export interface FiscalDocumentProps {
  id: string;
  saleId: string;
  type: FiscalDocumentTypeCode;
  status: FiscalDocumentStatusCode;
  documentNumber: string | null;
  accessKey: string | null;
  danfeUrl: string | null;
  qrCodeUrl: string | null;
  errorMessage: string | null;
  issuedAt: Date | null;
  updatedAt: Date;
}

export class FiscalDocument {
  readonly id: string;
  readonly saleId: string;
  readonly type: FiscalDocumentTypeCode;
  readonly status: FiscalDocumentStatusCode;
  readonly documentNumber: string | null;
  readonly accessKey: string | null;
  readonly danfeUrl: string | null;
  readonly qrCodeUrl: string | null;
  readonly errorMessage: string | null;
  readonly issuedAt: Date | null;
  readonly updatedAt: Date;

  constructor(props: FiscalDocumentProps) {
    this.id = props.id;
    this.saleId = props.saleId;
    this.type = props.type;
    this.status = props.status;
    this.documentNumber = props.documentNumber;
    this.accessKey = props.accessKey;
    this.danfeUrl = props.danfeUrl;
    this.qrCodeUrl = props.qrCodeUrl;
    this.errorMessage = props.errorMessage;
    this.issuedAt = props.issuedAt;
    this.updatedAt = props.updatedAt;
  }
}
