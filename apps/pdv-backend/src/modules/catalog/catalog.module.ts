import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { ProductsController } from "./infrastructure/controllers/products.controller.js";
import { CategoriesController } from "./infrastructure/controllers/categories.controller.js";
import { PriceListsController } from "./infrastructure/controllers/price-lists.controller.js";
import { PrismaProductRepository } from "./infrastructure/repositories/prisma-product.repository.js";
import { PrismaCategoryRepository } from "./infrastructure/repositories/prisma-category.repository.js";
import { PrismaPriceListRepository } from "./infrastructure/repositories/prisma-price-list.repository.js";
import { HttpBlingCatalogGateway } from "./infrastructure/gateways/http-bling-catalog.gateway.js";
import { PRODUCT_REPOSITORY } from "./application/ports/product-repository.port.js";
import { CATEGORY_REPOSITORY } from "./application/ports/category-repository.port.js";
import { PRICE_LIST_REPOSITORY } from "./application/ports/price-list-repository.port.js";
import { BLING_CATALOG_GATEWAY } from "./application/ports/bling-catalog-gateway.port.js";
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
import { SyncProductsFromBlingUseCase } from "./application/use-cases/sync-products-from-bling.use-case.js";
import { BlingStockSyncWorker } from "./infrastructure/workers/bling-stock-sync.worker.js";

@Module({
  imports: [AuditModule],
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
    SyncProductsFromBlingUseCase,
    BlingStockSyncWorker,
    { provide: PRODUCT_REPOSITORY, useClass: PrismaProductRepository },
    { provide: CATEGORY_REPOSITORY, useClass: PrismaCategoryRepository },
    { provide: PRICE_LIST_REPOSITORY, useClass: PrismaPriceListRepository },
    { provide: BLING_CATALOG_GATEWAY, useClass: HttpBlingCatalogGateway },
  ],
  // ResolvePriceUseCase é consumido pelo módulo Sales (AddSaleItemUseCase);
  // SyncProductsFromBlingUseCase é consumido pelo módulo Provisioning
  // (ActivateTerminalUseCase, sync automático do catálogo na ativação) —
  // leitura/uso síncrono entre módulos, mesmo padrão já documentado em
  // docs/MODULES.md. Nenhum dos dois cria ciclo: CatalogModule não depende
  // de SalesModule nem de ProvisioningModule de volta.
  exports: [ResolvePriceUseCase, SyncProductsFromBlingUseCase],
})
export class CatalogModule {}
