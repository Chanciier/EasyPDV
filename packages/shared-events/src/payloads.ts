import type { Sale } from "@easypdv/shared-types";
import type { EventName } from "./event-names.js";

export interface SaleConfirmedPayload {
  name: typeof EventName.SALE_CONFIRMED;
  occurredAt: string;
  sale: Sale;
}

export interface SyncFailedPayload {
  name: typeof EventName.SYNC_FAILED;
  occurredAt: string;
  entityType: string;
  localEntityId: string;
  attempts: number;
  lastError: string;
}
