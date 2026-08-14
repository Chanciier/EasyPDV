import { Module } from "@nestjs/common";
import { ProductsController } from "./infrastructure/controllers/products.controller.js";
import { CategoriesController } from "./infrastructure/controllers/categories.controller.js";
import { PriceListsController } from "./infrastructure/controllers/price-lists.controller.js";
import { PrismaProductRepository } from "./infrastructure/repositories/prisma-product.repository.js";
import { PrismaCategoryRepository } from "./infrastructure/repositories/prisma-category.repository.js";
import { PrismaPriceListRepository } from "./infrastructure/repositories/prisma-price-list.repository.js";
import { PRODUCT_REPOSITORY } from "./application/ports/product-repository.port.js";
import { CATEGORY_REPOSITORY } from "./application/ports/category-repository.port.js";
import { PRICE_LIST_REPOSITORY } from "./application/ports/price-list-repository.port.js";
import { CreateProductUseCase } from "./application/use-cases/create-product.use-case.js";
import { UpdateProductUseCase } from "./application/use-cases/update-product.use-case.js";
import { AddBarcodeUseCase } from "./application/use-cases/add-barcode.use-case.js";
import { FindProductByBarcodeUseCase } from "./application/use-cases/find-product-by-barcode.use-case.js";
import { GetProductUseCase } from "./application/use-cases/get-product.use-case.js";
import { SearchProductsUseCase } from "./application/use-cases/search-products.use-case.js";
import { CreateCategoryUseCase } from "./application/use-cases/create-category.use-case.js";
import { ListCategoriesUseCase } from "./application/use-cases/list-categories.use-case.js";
import { CreatePriceListUseCase } from "./application/use-cases/create-price-list.use-case.js";
import { UpsertPriceListItemUseCase } from "./application/use-cases/upsert-price-list-item.use-case.js";
import { GetActivePriceListUseCase } from "./application/use-cases/get-active-price-list.use-case.js";
import { ResolvePriceUseCase } from "./application/use-cases/resolve-price.use-case.js";

@Module({
  controllers: [ProductsController, CategoriesController, PriceListsController],
  providers: [
    CreateProductUseCase,
    UpdateProductUseCase,
    AddBarcodeUseCase,
    FindProductByBarcodeUseCase,
    GetProductUseCase,
    SearchProductsUseCase,
    CreateCategoryUseCase,
    ListCategoriesUseCase,
    CreatePriceListUseCase,
    UpsertPriceListItemUseCase,
    GetActivePriceListUseCase,
    ResolvePriceUseCase,
    { provide: PRODUCT_REPOSITORY, useClass: PrismaProductRepository },
    { provide: CATEGORY_REPOSITORY, useClass: PrismaCategoryRepository },
    { provide: PRICE_LIST_REPOSITORY, useClass: PrismaPriceListRepository },
  ],
  // ResolvePriceUseCase é consumido pelo módulo Sales (AddSaleItemUseCase) — leitura
  // síncrona entre módulos, permitida por docs/MODULES.md.
  exports: [ResolvePriceUseCase],
})
export class CatalogModule {}
