export type ErpProviderCode = "bling" | "tiny" | "omie" | "conta_azul" | "proprio";

export interface ErpIntegrationProps {
  id: string;
  organizationId: string;
  provider: ErpProviderCode;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  connectedAt: Date;
  updatedAt: Date;
}

export class ErpIntegration {
  readonly id: string;
  readonly organizationId: string;
  readonly provider: ErpProviderCode;
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: Date;
  readonly connectedAt: Date;
  readonly updatedAt: Date;

  constructor(props: ErpIntegrationProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.provider = props.provider;
    this.accessToken = props.accessToken;
    this.refreshToken = props.refreshToken;
    this.expiresAt = props.expiresAt;
    this.connectedAt = props.connectedAt;
    this.updatedAt = props.updatedAt;
  }

  /** Margem de 60s antes do expiresAt real — evita usar um token que expira no meio da requisição. */
  get isExpiringSoon(): boolean {
    return this.expiresAt.getTime() <= Date.now() + 60_000;
  }
}
