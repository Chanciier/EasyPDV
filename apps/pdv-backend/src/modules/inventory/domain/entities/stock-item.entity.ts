export interface StockItemProps {
  warehouseId: string;
  productId: string;
  quantity: number;
  reservedQuantity: number;
}

export class StockItem {
  readonly warehouseId: string;
  readonly productId: string;
  readonly quantity: number;
  readonly reservedQuantity: number;

  constructor(props: StockItemProps) {
    this.warehouseId = props.warehouseId;
    this.productId = props.productId;
    this.quantity = props.quantity;
    this.reservedQuantity = props.reservedQuantity;
  }

  get available(): number {
    return this.quantity - this.reservedQuantity;
  }
}
