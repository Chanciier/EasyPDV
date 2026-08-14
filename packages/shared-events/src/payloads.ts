import type { Sale } from "@easypdv/shared-types";
import type { EventName } from "./event-names.js";

export interface SaleConfirmedPayload {
  name: typeof EventName.SALE_CONFIRMED;
  occurredAt: string;
  sale: Sale;
}

export interface SyncRequestedPayload {
  name: typeof EventName.SYNC_REQUESTED;
  occurredAt: string;
  entityType: string;
  localEntityId: string;
}

export interface SyncSucceededPayload {
  name: typeof EventName.SYNC_SUCCEEDED;
  occurredAt: string;
  entityType: string;
  localEntityId: string;
  remoteEntityId?: string;
}

export interface SyncFailedPayload {
  name: typeof EventName.SYNC_FAILED;
  occurredAt: string;
  entityType: string;
  localEntityId: string;
  attempts: number;
  lastError: string;
}
