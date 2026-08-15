import type {
  Organization as PrismaOrganization,
  Store as PrismaStore,
  Terminal as PrismaTerminal,
  ActivationCode as PrismaActivationCode,
} from "../../../../generated/prisma/index.js";
import { Organization } from "../../domain/entities/organization.entity.js";
import { Store } from "../../domain/entities/store.entity.js";
import { Terminal } from "../../domain/entities/terminal.entity.js";
import { ActivationCode } from "../../domain/entities/activation-code.entity.js";

export function toDomainOrganization(record: PrismaOrganization): Organization {
  return new Organization({
    id: record.id,
    name: record.name,
    document: record.document,
    status: record.status,
    createdAt: record.createdAt,
  });
}

export function toDomainStore(record: PrismaStore): Store {
  return new Store({
    id: record.id,
    organizationId: record.organizationId,
    name: record.name,
    document: record.document,
    timezone: record.timezone,
    createdAt: record.createdAt,
  });
}

export function toDomainTerminal(record: PrismaTerminal): Terminal {
  return new Terminal({
    id: record.id,
    storeId: record.storeId,
    name: record.name,
    apiKeyHash: record.apiKeyHash,
    activatedAt: record.activatedAt,
    lastSeenAt: record.lastSeenAt,
  });
}

export function toDomainActivationCode(record: PrismaActivationCode): ActivationCode {
  return new ActivationCode({
    id: record.id,
    storeId: record.storeId,
    code: record.code,
    expiresAt: record.expiresAt,
    usedAt: record.usedAt,
    createdAt: record.createdAt,
  });
}
