import type { Terminal } from "../../domain/entities/terminal.entity.js";

export interface CreateTerminalData {
  storeId: string;
  name: string;
  apiKeyHash: string;
}

export interface TerminalRepositoryPort {
  create(data: CreateTerminalData): Promise<Terminal>;
  findByApiKeyHash(apiKeyHash: string): Promise<Terminal | null>;
  touchLastSeen(id: string): Promise<void>;
}

export const TERMINAL_REPOSITORY = Symbol("TERMINAL_REPOSITORY");
