import type { ErpProviderCode } from "./erp-integration.entity.js";

export interface ErpSyncMappingProps {
  id: string;
  organizationId: string;
  provider: ErpProviderCode;
  localEntityType: string;
  localEntityId: string;
  externalId: string;
  createdAt: Date;
}

export class ErpSyncMapping {
  readonly id: string;
  readonly organizationId: string;
  readonly provider: ErpProviderCode;
  readonly localEntityType: string;
  readonly localEntityId: string;
  readonly externalId: string;
  readonly createdAt: Date;

  constructor(props: ErpSyncMappingProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.provider = props.provider;
    this.localEntityType = props.localEntityType;
    this.localEntityId = props.localEntityId;
    this.externalId = props.externalId;
    this.createdAt = props.createdAt;
  }
}
