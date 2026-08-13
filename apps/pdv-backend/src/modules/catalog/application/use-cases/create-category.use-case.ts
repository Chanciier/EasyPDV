import { Inject, Injectable } from "@nestjs/common";
import type { CreateCategoryInput } from "@easypdv/shared-validation";
import { CategoryNotFoundError } from "../../domain/errors.js";
import type { Category } from "../../domain/entities/category.entity.js";
import { CATEGORY_REPOSITORY, type CategoryRepositoryPort } from "../ports/category-repository.port.js";

@Injectable()
export class CreateCategoryUseCase {
  constructor(@Inject(CATEGORY_REPOSITORY) private readonly categoryRepository: CategoryRepositoryPort) {}

  async execute(input: CreateCategoryInput): Promise<Category> {
    if (input.parentCategoryId) {
      const parent = await this.categoryRepository.findById(input.parentCategoryId);
      if (!parent) {
        throw new CategoryNotFoundError(input.parentCategoryId);
      }
    }
    return this.categoryRepository.create({
      name: input.name,
      parentCategoryId: input.parentCategoryId ?? null,
    });
  }
}
