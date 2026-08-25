import type { ErpProviderCode } from "../../../erp-integration/domain/entities/erp-integration.entity.js";

export interface ClubMembershipProps {
  id: string;
  organizationId: string;
  provider: ErpProviderCode;
  customerCpf: string;
  validUntil: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class ClubMembership {
  readonly id: string;
  readonly organizationId: string;
  readonly provider: ErpProviderCode;
  readonly customerCpf: string;
  readonly validUntil: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: ClubMembershipProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.provider = props.provider;
    this.customerCpf = props.customerCpf;
    this.validUntil = props.validUntil;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  get isValid(): boolean {
    return this.validUntil.getTime() >= Date.now();
  }
}
