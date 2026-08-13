import type { StockMovementType } from "@easypdv/shared-types";

export interface StockMovementProps {
  id: string;
  warehouseId: string;
  productId: string;
  type: StockMovementType;
  quantity: number;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: Date;
}

export class StockMovement {
  readonly id: string;
  readonly warehouseId: string;
  readonly productId: string;
  readonly type: StockMovementType;
  readonly quantity: number;
  readonly referenceType: string | null;
  readonly referenceId: string | null;
  readonly createdAt: Date;

  constructor(props: StockMovementProps) {
    this.id = props.id;
    this.warehouseId = props.warehouseId;
    this.productId = props.productId;
    this.type = props.type;
    this.quantity = props.quantity;
    this.referenceType = props.referenceType;
    this.referenceId = props.referenceId;
    this.createdAt = props.createdAt;
  }
}
