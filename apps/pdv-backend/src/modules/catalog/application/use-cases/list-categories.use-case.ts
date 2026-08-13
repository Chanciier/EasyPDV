import { Inject, Injectable } from "@nestjs/common";
import type { Category } from "../../domain/entities/category.entity.js";
import { CATEGORY_REPOSITORY, type CategoryRepositoryPort } from "../ports/category-repository.port.js";

@Injectable()
export class ListCategoriesUseCase {
  constructor(@Inject(CATEGORY_REPOSITORY) private readonly categoryRepository: CategoryRepositoryPort) {}

  execute(): Promise<Category[]> {
    return this.categoryRepository.findAll();
  }
}
