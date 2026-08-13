import type { PaymentMethod, PaymentStatus } from "@easypdv/shared-types";

export interface PaymentProps {
  id: string;
  saleId: string;
  method: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  authorizationCode: string | null;
  createdAt: Date;
}

export class Payment {
  readonly id: string;
  readonly saleId: string;
  readonly method: PaymentMethod;
  readonly amount: number;
  readonly status: PaymentStatus;
  readonly authorizationCode: string | null;
  readonly createdAt: Date;

  constructor(props: PaymentProps) {
    this.id = props.id;
    this.saleId = props.saleId;
    this.method = props.method;
    this.amount = props.amount;
    this.status = props.status;
    this.authorizationCode = props.authorizationCode;
    this.createdAt = props.createdAt;
  }
}
