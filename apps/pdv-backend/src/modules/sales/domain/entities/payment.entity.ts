import type { PaymentCardType, PaymentMethod, PaymentStatus } from "@easypdv/shared-types";

export interface PaymentProps {
  id: string;
  saleId: string;
  method: PaymentMethod;
  amount: number;
  cardType: PaymentCardType | null;
  installments: number | null;
  status: PaymentStatus;
  authorizationCode: string | null;
  createdAt: Date;
}

export class Payment {
  readonly id: string;
  readonly saleId: string;
  readonly method: PaymentMethod;
  readonly amount: number;
  readonly cardType: PaymentCardType | null;
  readonly installments: number | null;
  readonly status: PaymentStatus;
  readonly authorizationCode: string | null;
  readonly createdAt: Date;

  constructor(props: PaymentProps) {
    this.id = props.id;
    this.saleId = props.saleId;
    this.method = props.method;
    this.amount = props.amount;
    this.cardType = props.cardType;
    this.installments = props.installments;
    this.status = props.status;
    this.authorizationCode = props.authorizationCode;
    this.createdAt = props.createdAt;
  }
}
