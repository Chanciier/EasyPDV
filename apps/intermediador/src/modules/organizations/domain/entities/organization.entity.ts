export interface OrganizationProps {
  id: string;
  name: string;
  document: string | null;
  status: string;
  createdAt: Date;
}

export class Organization {
  readonly id: string;
  readonly name: string;
  readonly document: string | null;
  readonly status: string;
  readonly createdAt: Date;

  constructor(props: OrganizationProps) {
    this.id = props.id;
    this.name = props.name;
    this.document = props.document;
    this.status = props.status;
    this.createdAt = props.createdAt;
  }
}
