import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import type { SyncQueuePort } from "../../application/ports/sync-queue.port.js";
import { SYNC_JOB_NAME, SYNC_QUEUE_NAME } from "../../sync.constants.js";

// SLA de retry configurável fica como risco aberto (ver docs/ERROR-HANDLING.md);
// por enquanto attempts/backoff fixos garantem que uma falha transitória do
// ERP não perca o job, sem retentar indefinidamente.
@Injectable()
export class BullSyncQueueAdapter implements SyncQueuePort {
  constructor(@InjectQueue(SYNC_QUEUE_NAME) private readonly queue: Queue) {}

  async enqueue(syncJobId: string): Promise<void> {
    await this.queue.add(
      SYNC_JOB_NAME,
      { syncJobId },
      { attempts: 5, backoff: { type: "exponential", delay: 5000 } },
    );
  }
}
