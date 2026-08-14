import { Inject, Injectable } from "@nestjs/common";
import type { ErpIntegration } from "../../domain/entities/erp-integration.entity.js";
import { ERP_INTEGRATION_REPOSITORY, type ErpIntegrationRepositoryPort } from "../../application/ports/erp-integration-repository.port.js";
import { BlingOAuthClient } from "./bling-oauth.client.js";

/**
 * Garante um access_token válido antes de qualquer chamada à API do Bling,
 * renovando via refresh_token quando estiver perto de expirar. O Bling
 * rotaciona o refresh_token a cada uso — por isso sempre persistimos os dois
 * tokens novos juntos (nunca só o access_token), ver BlingOAuthClient.
 */
@Injectable()
export class BlingTokenProviderService {
  constructor(
    private readonly oauthClient: BlingOAuthClient,
    @Inject(ERP_INTEGRATION_REPOSITORY) private readonly erpIntegrationRepository: ErpIntegrationRepositoryPort,
  ) {}

  async getValidAccessToken(integration: ErpIntegration): Promise<string> {
    if (!integration.isExpiringSoon) {
      return integration.accessToken;
    }

    const refreshed = await this.oauthClient.refreshToken(integration.refreshToken);
    const updated = await this.erpIntegrationRepository.upsert({
      organizationId: integration.organizationId,
      provider: integration.provider,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      expiresAt: refreshed.expiresAt,
    });
    return updated.accessToken;
  }
}
