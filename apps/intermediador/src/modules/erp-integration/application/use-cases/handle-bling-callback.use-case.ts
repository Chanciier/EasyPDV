import { Inject, Injectable } from "@nestjs/common";
import type { ErpIntegration } from "../../domain/entities/erp-integration.entity.js";
import { BlingOAuthClient } from "../../infrastructure/clients/bling-oauth.client.js";
import { ERP_INTEGRATION_REPOSITORY, type ErpIntegrationRepositoryPort } from "../ports/erp-integration-repository.port.js";

@Injectable()
export class HandleBlingCallbackUseCase {
  constructor(
    private readonly oauthClient: BlingOAuthClient,
    @Inject(ERP_INTEGRATION_REPOSITORY) private readonly erpIntegrationRepository: ErpIntegrationRepositoryPort,
  ) {}

  async execute(code: string, state: string): Promise<ErpIntegration> {
    const organizationId = Buffer.from(state, "base64url").toString("utf8");
    const token = await this.oauthClient.exchangeCode(code);
    return this.erpIntegrationRepository.upsert({
      organizationId,
      provider: "bling",
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAt: token.expiresAt,
    });
  }
}
