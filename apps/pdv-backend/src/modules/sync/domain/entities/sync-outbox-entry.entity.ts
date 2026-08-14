export type SyncOutboxStatus = "pending" | "processing" | "synced" | "failed";

export interface SyncOutboxEntryProps {
  id: string;
  entityType: string;
  entityId: string;
  payload: string;
  status: SyncOutboxStatus;
  attempts: number;
  lastError: string | null;
  createdAt: Date;
  sentAt: Date | null;
}

export class SyncOutboxEntry {
  readonly id: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly payload: string;
  readonly status: SyncOutboxStatus;
  readonly attempts: number;
  readonly lastError: string | null;
  readonly createdAt: Date;
  readonly sentAt: Date | null;

  constructor(props: SyncOutboxEntryProps) {
    this.id = props.id;
    this.entityType = props.entityType;
    this.entityId = props.entityId;
    this.payload = props.payload;
    this.status = props.status;
    this.attempts = props.attempts;
    this.lastError = props.lastError;
    this.createdAt = props.createdAt;
    this.sentAt = props.sentAt;
  }
}
