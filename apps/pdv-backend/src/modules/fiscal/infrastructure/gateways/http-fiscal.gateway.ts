import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { FiscalStatusPayload } from "@easypdv/shared-types";
import {
  STORE_IDENTITY_REPOSITORY,
  type StoreIdentityRepositoryPort,
} from "../../../provisioning/application/ports/store-identity-repository.port.js";
import type { FiscalGatewayPort } from "../../application/ports/fiscal-gateway.port.js";

/** Mesmo padrão de HttpSyncGateway (Sprint 6/10) — apiKey de terminal lida do StoreIdentity local a cada chamada. */
@Injectable()
export class HttpFiscalGateway implements FiscalGatewayPort {
  private readonly baseUrl: string;

  constructor(
    configService: ConfigService,
    @Inject(STORE_IDENTITY_REPOSITORY) private readonly storeIdentityRepository: StoreIdentityRepositoryPort,
  ) {
    this.baseUrl = configService.get<string>("INTERMEDIADOR_URL") ?? "http://127.0.0.1:4002";
  }

  async fetchStatus(saleId: string): Promise<FiscalStatusPayload | null> {
    const identity = await this.storeIdentityRepository.find();
    if (!identity) {
      return null;
    }

    const response = await fetch(`${this.baseUrl}/fiscal/sale/${encodeURIComponent(saleId)}`, {
      headers: { "X-Terminal-Api-Key": identity.apiKey },
    });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`Intermediador respondeu ${response.status} para GET /fiscal/sale/${saleId}`);
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
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Intermediador respondeu ${response.status} para POST /fiscal/sale/${saleId}/issue: ${body}`);
    }
    return (await response.json()) as FiscalStatusPayload;
  }
}
