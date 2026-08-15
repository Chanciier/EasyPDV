export interface StoreProps {
  id: string;
  organizationId: string;
  name: string;
  document: string | null;
  timezone: string;
  createdAt: Date;
}

export class Store {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly document: string | null;
  readonly timezone: string;
  readonly createdAt: Date;

  constructor(props: StoreProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.name = props.name;
    this.document = props.document;
    this.timezone = props.timezone;
    this.createdAt = props.createdAt;
  }
}
