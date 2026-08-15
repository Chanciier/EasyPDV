import type { StoreIdentity } from "../../domain/entities/store-identity.entity.js";

export interface CreateStoreIdentityData {
  organizationId: string;
  storeId: string;
  storeName: string;
  terminalId: string;
  apiKey: string;
}

export interface StoreIdentityRepositoryPort {
  /** No máximo uma linha por instalação — um .exe = um terminal. */
  find(): Promise<StoreIdentity | null>;
  create(data: CreateStoreIdentityData): Promise<StoreIdentity>;
}

export const STORE_IDENTITY_REPOSITORY = Symbol("STORE_IDENTITY_REPOSITORY");
