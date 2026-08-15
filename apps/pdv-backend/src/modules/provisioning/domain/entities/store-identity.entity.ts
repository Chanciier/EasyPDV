export interface StoreIdentityProps {
  id: string;
  organizationId: string;
  storeId: string;
  storeName: string;
  terminalId: string;
  apiKey: string;
  activatedAt: Date;
}

export class StoreIdentity {
  readonly id: string;
  readonly organizationId: string;
  readonly storeId: string;
  readonly storeName: string;
  readonly terminalId: string;
  readonly apiKey: string;
  readonly activatedAt: Date;

  constructor(props: StoreIdentityProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.storeId = props.storeId;
    this.storeName = props.storeName;
    this.terminalId = props.terminalId;
    this.apiKey = props.apiKey;
    this.activatedAt = props.activatedAt;
  }
}
