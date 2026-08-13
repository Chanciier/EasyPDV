import type { CashSessionStatus } from "@easypdv/shared-types";

export interface CashSessionProps {
  id: string;
  cashRegisterId: string;
  operatorUserId: string;
  openingAmount: number;
  closingAmount: number | null;
  expectedAmount: number | null;
  status: CashSessionStatus;
  openedAt: Date;
  closedAt: Date | null;
}

export class CashSession {
  readonly id: string;
  readonly cashRegisterId: string;
  readonly operatorUserId: string;
  readonly openingAmount: number;
  readonly closingAmount: number | null;
  readonly expectedAmount: number | null;
  readonly status: CashSessionStatus;
  readonly openedAt: Date;
  readonly closedAt: Date | null;

  constructor(props: CashSessionProps) {
    this.id = props.id;
    this.cashRegisterId = props.cashRegisterId;
    this.operatorUserId = props.operatorUserId;
    this.openingAmount = props.openingAmount;
    this.closingAmount = props.closingAmount;
    this.expectedAmount = props.expectedAmount;
    this.status = props.status;
    this.openedAt = props.openedAt;
    this.closedAt = props.closedAt;
  }

  get isOpen(): boolean {
    return this.status === "open";
  }
}
