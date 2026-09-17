import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DEFAULT_INTERMEDIADOR_TIMEOUT_MS, getIntermediadorUrl } from "../../../../common/intermediador-config.js";
import { throwDescriptiveHttpError } from "../../../../common/describe-http-error.js";
import {
  STORE_IDENTITY_REPOSITORY,
  type StoreIdentityRepositoryPort,
} from "../../../provisioning/application/ports/store-identity-repository.port.js";
import type { SyncGatewayEntry, SyncGatewayPort } from "../../application/ports/sync-gateway.port.js";

/**
 * POST /sync no Intermediador exige apiKey de terminal (Sprint 10,
 * TerminalApiKeyGuard) — lida do StoreIdentity local (SQLite) a cada envio,
 * não cacheada em memória, pra sempre refletir uma reativação eventual sem
 * precisar reiniciar o processo. Se o terminal ainda não foi ativado, falha
 * com um erro claro — o SyncOutboxWorker já retenta com backoff (ver
 * docs/ERROR-HANDLING.md), então isso se resolve sozinho assim que o
 * operador ativar o terminal pela UI do Electron.
 */
@Injectable()
export class HttpSyncGateway implements SyncGatewayPort {
  private readonly baseUrl: string;

  constructor(
    configService: ConfigService,
    @Inject(STORE_IDENTITY_REPOSITORY) private readonly storeIdentityRepository: StoreIdentityRepositoryPort,
  ) {
    this.baseUrl = getIntermediadorUrl(configService);
  }

  async send(entry: SyncGatewayEntry): Promise<void> {
    const identity = await this.storeIdentityRepository.find();
    if (!identity) {
      throw new Error("Terminal ainda não foi ativado — sem apiKey pra sincronizar com o Intermediador");
    }

    const response = await fetch(`${this.baseUrl}/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Terminal-Api-Key": identity.apiKey },
      body: JSON.stringify(entry),
      signal: AbortSignal.timeout(DEFAULT_INTERMEDIADOR_TIMEOUT_MS),
    });
    if (!response.ok) {
      await throwDescriptiveHttpError(response, `POST /sync (${entry.entityType}:${entry.entityId})`);
    }
  }
}
