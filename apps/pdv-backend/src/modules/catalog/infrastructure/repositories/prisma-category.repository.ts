import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service.js";
import { Category } from "../../domain/entities/category.entity.js";
import type {
  CategoryRepositoryPort,
  CreateCategoryData,
} from "../../application/ports/category-repository.port.js";
import { toDomainCategory } from "../mappers/catalog.mapper.js";

@Injectable()
export class PrismaCategoryRepository implements CategoryRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Category | null> {
    const record = await this.prisma.category.findUnique({ where: { id } });
    return record ? toDomainCategory(record) : null;
  }

  async findAll(): Promise<Category[]> {
    const records = await this.prisma.category.findMany({ orderBy: { name: "asc" } });
    return records.map(toDomainCategory);
  }

  async create(data: CreateCategoryData): Promise<Category> {
    const record = await this.prisma.category.create({ data });
    return toDomainCategory(record);
  }
}
