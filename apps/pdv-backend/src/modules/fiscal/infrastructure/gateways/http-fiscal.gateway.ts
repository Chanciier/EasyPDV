import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DEFAULT_INTERMEDIADOR_TIMEOUT_MS, getIntermediadorUrl } from "../../../../common/intermediador-config.js";
import type { FiscalStatusPayload } from "@easypdv/shared-types";
import {
  STORE_IDENTITY_REPOSITORY,
  type StoreIdentityRepositoryPort,
} from "../../../provisioning/application/ports/store-identity-repository.port.js";
import { throwDescriptiveHttpError } from "../../../../common/describe-http-error.js";
import type { FiscalGatewayPort } from "../../application/ports/fiscal-gateway.port.js";

/** Ação fiscal real (issue/retry/reissue) pode envolver round-trip do Intermediador com a SEFAZ via Bling — timeout mais folgado que o default pra não cortar uma emissão que só está demorando. */
const FISCAL_ACTION_TIMEOUT_MS = 20_000;

/** Mesmo padrão de HttpSyncGateway (Sprint 6/10) — apiKey de terminal lida do StoreIdentity local a cada chamada. */
@Injectable()
export class HttpFiscalGateway implements FiscalGatewayPort {
  private readonly baseUrl: string;

  constructor(
    configService: ConfigService,
    @Inject(STORE_IDENTITY_REPOSITORY) private readonly storeIdentityRepository: StoreIdentityRepositoryPort,
  ) {
    this.baseUrl = getIntermediadorUrl(configService);
  }

  async fetchStatus(saleId: string): Promise<FiscalStatusPayload | null> {
    const identity = await this.storeIdentityRepository.find();
    if (!identity) {
      return null;
    }

    const response = await fetch(`${this.baseUrl}/fiscal/sale/${encodeURIComponent(saleId)}`, {
      headers: { "X-Terminal-Api-Key": identity.apiKey },
      signal: AbortSignal.timeout(DEFAULT_INTERMEDIADOR_TIMEOUT_MS),
    });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      await throwDescriptiveHttpError(response, `GET /fiscal/sale/${saleId}`);
    }
    return (await response.json()) as FiscalStatusPayload;
  }

  async issueManually(saleId: string): Promise<FiscalStatusPayload | null> {
    const identity = await this.storeIdentityRepository.find();
    if (!identity) {
      return null;
    }

    const response = await fetch(`${this.baseUrl}/fiscal/sale/${encodeURIComponent(saleId)}/issue`, {
      method: "POST",
      headers: { "X-Terminal-Api-Key": identity.apiKey },
      signal: AbortSignal.timeout(FISCAL_ACTION_TIMEOUT_MS),
    });
    if (!response.ok) {
      await throwDescriptiveHttpError(response, `POST /fiscal/sale/${saleId}/issue`);
    }
    return (await response.json()) as FiscalStatusPayload;
  }

  async retryManually(saleId: string): Promise<FiscalStatusPayload | null> {
    const identity = await this.storeIdentityRepository.find();
    if (!identity) {
      return null;
    }

    const response = await fetch(`${this.baseUrl}/fiscal/sale/${encodeURIComponent(saleId)}/retry`, {
      method: "POST",
      headers: { "X-Terminal-Api-Key": identity.apiKey },
      signal: AbortSignal.timeout(FISCAL_ACTION_TIMEOUT_MS),
    });
    if (!response.ok) {
      await throwDescriptiveHttpError(response, `POST /fiscal/sale/${saleId}/retry`);
    }
    return (await response.json()) as FiscalStatusPayload;
  }

  async reissueManually(saleId: string): Promise<FiscalStatusPayload | null> {
    const identity = await this.storeIdentityRepository.find();
    if (!identity) {
      return null;
    }

    const response = await fetch(`${this.baseUrl}/fiscal/sale/${encodeURIComponent(saleId)}/reissue`, {
      method: "POST",
      headers: { "X-Terminal-Api-Key": identity.apiKey },
      signal: AbortSignal.timeout(FISCAL_ACTION_TIMEOUT_MS),
    });
    if (!response.ok) {
      await throwDescriptiveHttpError(response, `POST /fiscal/sale/${saleId}/reissue`);
    }
    return (await response.json()) as FiscalStatusPayload;
  }
}
