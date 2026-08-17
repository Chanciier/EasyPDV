export interface CustomerProps {
  id: string;
  name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
}

export class Customer {
  readonly id: string;
  readonly name: string;
  readonly document: string | null;
  readonly phone: string | null;
  readonly email: string | null;

  constructor(props: CustomerProps) {
    this.id = props.id;
    this.name = props.name;
    this.document = props.document;
    this.phone = props.phone;
    this.email = props.email;
  }
}
