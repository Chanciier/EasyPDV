import { Inject, Injectable } from "@nestjs/common";
import {
  STORE_IDENTITY_REPOSITORY,
  type StoreIdentityRepositoryPort,
} from "../ports/store-identity-repository.port.js";

export interface ProvisioningStatus {
  activated: boolean;
  organizationId: string | null;
  storeId: string | null;
  storeName: string | null;
}

/** Consultado pelo Electron (main process) no boot pra decidir: UI de ativação ou app normal. */
@Injectable()
export class GetProvisioningStatusUseCase {
  constructor(
    @Inject(STORE_IDENTITY_REPOSITORY) private readonly storeIdentityRepository: StoreIdentityRepositoryPort,
  ) {}

  async execute(): Promise<ProvisioningStatus> {
    const identity = await this.storeIdentityRepository.find();
    if (!identity) {
      return { activated: false, organizationId: null, storeId: null, storeName: null };
    }
    return {
      activated: true,
      organizationId: identity.organizationId,
      storeId: identity.storeId,
      storeName: identity.storeName,
    };
  }
}
