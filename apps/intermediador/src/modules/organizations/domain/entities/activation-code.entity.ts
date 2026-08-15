export interface ActivationCodeProps {
  id: string;
  storeId: string;
  code: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export class ActivationCode {
  readonly id: string;
  readonly storeId: string;
  readonly code: string;
  readonly expiresAt: Date;
  readonly usedAt: Date | null;
  readonly createdAt: Date;

  constructor(props: ActivationCodeProps) {
    this.id = props.id;
    this.storeId = props.storeId;
    this.code = props.code;
    this.expiresAt = props.expiresAt;
    this.usedAt = props.usedAt;
    this.createdAt = props.createdAt;
  }

  get isExpired(): boolean {
    return this.expiresAt.getTime() <= Date.now();
  }

  get isUsed(): boolean {
    return this.usedAt !== null;
  }
}
