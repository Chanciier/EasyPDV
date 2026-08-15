import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service.js";
import type { StoreIdentity } from "../../domain/entities/store-identity.entity.js";
import type {
  CreateStoreIdentityData,
  StoreIdentityRepositoryPort,
} from "../../application/ports/store-identity-repository.port.js";
import { toDomainStoreIdentity } from "../mappers/provisioning.mapper.js";

@Injectable()
export class PrismaStoreIdentityRepository implements StoreIdentityRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async find(): Promise<StoreIdentity | null> {
    const record = await this.prisma.storeIdentity.findFirst();
    return record ? toDomainStoreIdentity(record) : null;
  }

  async create(data: CreateStoreIdentityData): Promise<StoreIdentity> {
    const record = await this.prisma.storeIdentity.create({ data });
    return toDomainStoreIdentity(record);
  }
}
