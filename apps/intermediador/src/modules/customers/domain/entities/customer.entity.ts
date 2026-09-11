export interface CustomerProps {
  id: string;
  organizationId: string;
  name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Customer {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly document: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: CustomerProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.name = props.name;
    this.document = props.document;
    this.phone = props.phone;
    this.email = props.email;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}
