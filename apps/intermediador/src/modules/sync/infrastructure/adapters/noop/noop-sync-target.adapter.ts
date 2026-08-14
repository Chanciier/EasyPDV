import { Injectable, Logger } from "@nestjs/common";
import type { SyncTargetInput, SyncTargetPort } from "../../../application/ports/sync-target.port.js";

/**
 * Placeholder até a Sprint 7 (Adapter Bling). Só loga e confirma como
 * sincronizado — prova a infraestrutura de fila/worker ponta a ponta sem
 * falar com nenhum ERP de verdade ainda. Ver docs/ROADMAP.md.
 */
@Injectable()
export class NoopSyncTargetAdapter implements SyncTargetPort {
  private readonly logger = new Logger(NoopSyncTargetAdapter.name);

  async process(input: SyncTargetInput): Promise<void> {
    this.logger.log(`[noop] sincronizaria ${input.entityType}:${input.entityId} com o ERP (Adapter Bling — Sprint 7)`);
    await Promise.resolve();
  }
}
