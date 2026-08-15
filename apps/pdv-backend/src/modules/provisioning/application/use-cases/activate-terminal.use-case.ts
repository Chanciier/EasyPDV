import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { TerminalActivationResult } from "@easypdv/shared-types";
import type { StoreIdentity } from "../../domain/entities/store-identity.entity.js";
import { ActivationFailedError, AlreadyActivatedError } from "../../domain/errors.js";
import {
  STORE_IDENTITY_REPOSITORY,
  type StoreIdentityRepositoryPort,
} from "../ports/store-identity-repository.port.js";

export interface ActivateTerminalCommand {
  code: string;
  terminalName?: string;
}

/**
 * Chama o Intermediador (POST /terminals/activate) pra trocar o código de
 * ativação por uma identidade de terminal + apiKey, e persiste localmente
 * (StoreIdentity, SQLite) — a apiKey em texto puro é o que HttpSyncGateway
 * usa depois pra autenticar POST /sync. Chamado pelo Electron (main process)
 * no primeiro boot sem terminal ativado. Ver docs/ELECTRON.md.
 */
@Injectable()
export class ActivateTerminalUseCase {
  private readonly intermediadorUrl: string;

  constructor(
    @Inject(STORE_IDENTITY_REPOSITORY) private readonly storeIdentityRepository: StoreIdentityRepositoryPort,
    configService: ConfigService,
  ) {
    this.intermediadorUrl = configService.get<string>("INTERMEDIADOR_URL") ?? "http://127.0.0.1:4002";
  }

  async execute(command: ActivateTerminalCommand): Promise<StoreIdentity> {
    const existing = await this.storeIdentityRepository.find();
    if (existing) {
      throw new AlreadyActivatedError();
    }

    const response = await fetch(`${this.intermediadorUrl}/terminals/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: command.code, terminalName: command.terminalName }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new ActivationFailedError(body?.message ?? `Intermediador respondeu ${response.status}`);
    }

    const result = (await response.json()) as TerminalActivationResult;

    return this.storeIdentityRepository.create({
      organizationId: result.organizationId,
      storeId: result.storeId,
      storeName: result.storeName,
      terminalId: result.terminalId,
      apiKey: result.apiKey,
    });
  }
}
