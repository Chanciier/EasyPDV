import { Inject, Injectable } from "@nestjs/common";
import { InvalidTerminalApiKeyError, StoreNotFoundError } from "../../domain/errors.js";
import { TERMINAL_REPOSITORY, type TerminalRepositoryPort } from "../ports/terminal-repository.port.js";
import { STORE_REPOSITORY, type StoreRepositoryPort } from "../ports/store-repository.port.js";
import { hashApiKey } from "./activate-terminal.use-case.js";

export interface VerifiedTerminal {
  terminalId: string;
  storeId: string;
  organizationId: string;
}

/** Usado por TerminalApiKeyGuard (infrastructure/guards) — não é chamado por nenhum controller diretamente. */
@Injectable()
export class VerifyTerminalApiKeyUseCase {
  constructor(
    @Inject(TERMINAL_REPOSITORY) private readonly terminalRepository: TerminalRepositoryPort,
    @Inject(STORE_REPOSITORY) private readonly storeRepository: StoreRepositoryPort,
  ) {}

  async execute(apiKey: string): Promise<VerifiedTerminal> {
    const terminal = await this.terminalRepository.findByApiKeyHash(hashApiKey(apiKey));
    if (!terminal) {
      throw new InvalidTerminalApiKeyError();
    }
    void this.terminalRepository.touchLastSeen(terminal.id);

    const store = await this.storeRepository.findById(terminal.storeId);
    if (!store) {
      throw new StoreNotFoundError(terminal.storeId);
    }

    return { terminalId: terminal.id, storeId: terminal.storeId, organizationId: store.organizationId };
  }
}
