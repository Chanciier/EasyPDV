import { Inject, Injectable } from "@nestjs/common";
import type { Terminal } from "../../domain/entities/terminal.entity.js";
import { InvalidTerminalApiKeyError } from "../../domain/errors.js";
import { TERMINAL_REPOSITORY, type TerminalRepositoryPort } from "../ports/terminal-repository.port.js";
import { hashApiKey } from "./activate-terminal.use-case.js";

/** Usado por TerminalApiKeyGuard (infrastructure/guards) — não é chamado por nenhum controller diretamente. */
@Injectable()
export class VerifyTerminalApiKeyUseCase {
  constructor(@Inject(TERMINAL_REPOSITORY) private readonly terminalRepository: TerminalRepositoryPort) {}

  async execute(apiKey: string): Promise<Terminal> {
    const terminal = await this.terminalRepository.findByApiKeyHash(hashApiKey(apiKey));
    if (!terminal) {
      throw new InvalidTerminalApiKeyError();
    }
    void this.terminalRepository.touchLastSeen(terminal.id);
    return terminal;
  }
}
