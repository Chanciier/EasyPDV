export interface PriceListItemProps {
  id: string;
  priceListId: string;
  productId: string;
  price: number;
  promotionalPrice: number | null;
}

export class PriceListItem {
  readonly id: string;
  readonly priceListId: string;
  readonly productId: string;
  readonly price: number;
  readonly promotionalPrice: number | null;

  constructor(props: PriceListItemProps) {
    this.id = props.id;
    this.priceListId = props.priceListId;
    this.productId = props.productId;
    this.price = props.price;
    this.promotionalPrice = props.promotionalPrice;
  }

  /** Preço promocional, quando existe, sempre prevalece sobre o preço cheio. */
  get effectivePrice(): number {
    return this.promotionalPrice ?? this.price;
  }
}
