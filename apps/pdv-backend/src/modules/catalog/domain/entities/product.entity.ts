export interface ProductProps {
  id: string;
  sku: string;
  name: string;
  categoryId: string | null;
  unit: string;
  active: boolean;
}

export class Product {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  readonly categoryId: string | null;
  readonly unit: string;
  readonly active: boolean;

  constructor(props: ProductProps) {
    this.id = props.id;
    this.sku = props.sku;
    this.name = props.name;
    this.categoryId = props.categoryId;
    this.unit = props.unit;
    this.active = props.active;
  }
}
