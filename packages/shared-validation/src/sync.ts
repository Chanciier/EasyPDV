import { z } from "zod";

// Sprint 6: POST /sync no Intermediador (chamado pelo SyncOutboxWorker do PDV local).
// storeId não é mais um campo do body (Sprint 10) — é derivado server-side do
// terminal autenticado via TerminalApiKeyGuard, não confiável vindo do cliente.
export const requestSyncSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  payload: z.record(z.unknown()),
});

export type RequestSyncInput = z.infer<typeof requestSyncSchema>;
