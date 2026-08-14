export type SyncJobStatus = "pending" | "processing" | "synced" | "failed";

export interface SyncJobProps {
  id: string;
  storeId: string | null;
  entityType: string;
  entityId: string;
  payload: unknown;
  status: SyncJobStatus;
  attempts: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class SyncJob {
  readonly id: string;
  readonly storeId: string | null;
  readonly entityType: string;
  readonly entityId: string;
  readonly payload: unknown;
  readonly status: SyncJobStatus;
  readonly attempts: number;
  readonly lastError: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: SyncJobProps) {
    this.id = props.id;
    this.storeId = props.storeId;
    this.entityType = props.entityType;
    this.entityId = props.entityId;
    this.payload = props.payload;
    this.status = props.status;
    this.attempts = props.attempts;
    this.lastError = props.lastError;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}
