import type { Store } from "../../domain/entities/store.entity.js";

export interface CreateStoreData {
  organizationId: string;
  name: string;
}

export interface StoreRepositoryPort {
  create(data: CreateStoreData): Promise<Store>;
  findById(id: string): Promise<Store | null>;
}

export const STORE_REPOSITORY = Symbol("STORE_REPOSITORY");
