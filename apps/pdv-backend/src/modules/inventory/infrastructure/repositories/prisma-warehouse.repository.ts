import { Injectable } from "@nestjs/common";
import type { Warehouse } from "@easypdv/shared-types";
import { PrismaService } from "../../../../prisma/prisma.service.js";
import type { WarehouseRepositoryPort } from "../../application/ports/warehouse-repository.port.js";

@Injectable()
export class PrismaWarehouseRepository implements WarehouseRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<Warehouse | null> {
    return this.prisma.warehouse.findUnique({ where: { id } });
  }

  findAll(): Promise<Warehouse[]> {
    return this.prisma.warehouse.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  }

  create(name: string): Promise<Warehouse> {
    return this.prisma.warehouse.create({ data: { name } });
  }
}
