import { z } from "zod";

// Sprint 6: POST /sync no Intermediador (chamado pelo SyncOutboxWorker do PDV local).
export const requestSyncSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  payload: z.record(z.unknown()),
  storeId: z.string().optional(),
});

export type RequestSyncInput = z.infer<typeof requestSyncSchema>;
