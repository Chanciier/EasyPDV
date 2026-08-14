import { Inject, Injectable } from "@nestjs/common";
import { ERP_INTEGRATION_REPOSITORY, type ErpIntegrationRepositoryPort } from "../ports/erp-integration-repository.port.js";

export interface BlingConnectionStatus {
  connected: boolean;
  connectedAt: Date | null;
  expiresAt: Date | null;
}

@Injectable()
export class GetBlingConnectionStatusUseCase {
  constructor(@Inject(ERP_INTEGRATION_REPOSITORY) private readonly erpIntegrationRepository: ErpIntegrationRepositoryPort) {}

  async execute(organizationId: string): Promise<BlingConnectionStatus> {
    const integration = await this.erpIntegrationRepository.findByOrganization(organizationId, "bling");
    return {
      connected: integration !== null,
      connectedAt: integration?.connectedAt ?? null,
      expiresAt: integration?.expiresAt ?? null,
    };
  }
}
