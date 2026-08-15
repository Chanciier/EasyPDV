import { createHash, randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { ActivateTerminalInput } from "@easypdv/shared-validation";
import type { TerminalActivationResult } from "@easypdv/shared-types";
import {
  ActivationCodeAlreadyUsedError,
  ActivationCodeExpiredError,
  ActivationCodeInvalidError,
  StoreNotFoundError,
} from "../../domain/errors.js";
import {
  ACTIVATION_CODE_REPOSITORY,
  type ActivationCodeRepositoryPort,
} from "../ports/activation-code-repository.port.js";
import { STORE_REPOSITORY, type StoreRepositoryPort } from "../ports/store-repository.port.js";
import { TERMINAL_REPOSITORY, type TerminalRepositoryPort } from "../ports/terminal-repository.port.js";

/**
 * SHA-256, não bcrypt: a apiKey já nasce alta-entropia/aleatória (32 bytes de
 * crypto.randomBytes), então o risco que bcrypt existe pra mitigar (força
 * bruta sobre segredo de baixa entropia, como senha humana) não se aplica
 * aqui — o que importa é lookup determinístico rápido por índice único
 * (Terminal.apiKeyHash), que bcrypt (salgado, não determinístico) não permite.
 * Ver User.passwordHash (Identity, Sprint 1) pro caso onde bcrypt é o certo.
 */
export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

/**
 * Troca um código de ativação por uma identidade de Terminal permanente +
 * apiKey (retornada em texto puro só aqui, uma única vez — nunca persistida,
 * só o hash). Chamado pelo Electron no primeiro boot sem terminal ativado.
 * Ver docs/ELECTRON.md.
 */
@Injectable()
export class ActivateTerminalUseCase {
  constructor(
    @Inject(ACTIVATION_CODE_REPOSITORY) private readonly activationCodeRepository: ActivationCodeRepositoryPort,
    @Inject(STORE_REPOSITORY) private readonly storeRepository: StoreRepositoryPort,
    @Inject(TERMINAL_REPOSITORY) private readonly terminalRepository: TerminalRepositoryPort,
  ) {}

  async execute(input: ActivateTerminalInput): Promise<TerminalActivationResult> {
    const activationCode = await this.activationCodeRepository.findByCode(input.code);
    if (!activationCode) {
      throw new ActivationCodeInvalidError();
    }
    if (activationCode.isUsed) {
      throw new ActivationCodeAlreadyUsedError();
    }
    if (activationCode.isExpired) {
      throw new ActivationCodeExpiredError();
    }

    const store = await this.storeRepository.findById(activationCode.storeId);
    if (!store) {
      throw new StoreNotFoundError(activationCode.storeId);
    }

    // Corrida: duas ativações concorrentes com o mesmo código — só uma vence o
    // UPDATE condicional (WHERE usedAt IS NULL). Mesmo padrão já usado no
    // retry de SyncJob (Sprint 8): não confiar em ler-depois-escrever.
    const won = await this.activationCodeRepository.markUsed(activationCode.id);
    if (!won) {
      throw new ActivationCodeAlreadyUsedError();
    }

    const apiKey = randomBytes(32).toString("base64url");
    const terminal = await this.terminalRepository.create({
      storeId: store.id,
      name: input.terminalName ?? "Terminal",
      apiKeyHash: hashApiKey(apiKey),
    });

    return {
      terminalId: terminal.id,
      organizationId: store.organizationId,
      storeId: store.id,
      storeName: store.name,
      apiKey,
    };
  }
}
