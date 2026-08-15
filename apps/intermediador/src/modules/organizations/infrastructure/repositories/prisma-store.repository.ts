import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service.js";
import type { Store } from "../../domain/entities/store.entity.js";
import type { CreateStoreData, StoreRepositoryPort } from "../../application/ports/store-repository.port.js";
import { toDomainStore } from "../mappers/organizations.mapper.js";

@Injectable()
export class PrismaStoreRepository implements StoreRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateStoreData): Promise<Store> {
    const record = await this.prisma.store.create({ data });
    return toDomainStore(record);
  }

  async findById(id: string): Promise<Store | null> {
    const record = await this.prisma.store.findUnique({ where: { id } });
    return record ? toDomainStore(record) : null;
  }
}
