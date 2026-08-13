import type { Category } from "../../domain/entities/category.entity.js";

export interface CreateCategoryData {
  name: string;
  parentCategoryId: string | null;
}

export interface CategoryRepositoryPort {
  findById(id: string): Promise<Category | null>;
  findAll(): Promise<Category[]>;
  create(data: CreateCategoryData): Promise<Category>;
}

export const CATEGORY_REPOSITORY = Symbol("CATEGORY_REPOSITORY");
