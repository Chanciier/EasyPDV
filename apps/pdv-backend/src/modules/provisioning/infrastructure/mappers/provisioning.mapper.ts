import type { StoreIdentity as PrismaStoreIdentity } from "@prisma/client";
import { StoreIdentity } from "../../domain/entities/store-identity.entity.js";

export function toDomainStoreIdentity(record: PrismaStoreIdentity): StoreIdentity {
  return new StoreIdentity({
    id: record.id,
    organizationId: record.organizationId,
    storeId: record.storeId,
    storeName: record.storeName,
    terminalId: record.terminalId,
    apiKey: record.apiKey,
    activatedAt: record.activatedAt,
  });
}
