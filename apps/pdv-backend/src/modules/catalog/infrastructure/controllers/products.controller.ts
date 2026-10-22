import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import {
  addBarcodeSchema,
  createProductSchema,
  updateProductSchema,
  type AddBarcodeInput,
  type CreateProductInput,
  type UpdateProductInput,
} from "@easypdv/shared-validation";
import { z } from "zod";
import { ZodValidationPipe } from "../../../../common/pipes/zod-validation.pipe.js";
import { JwtAuthGuard } from "../../../identity/infrastructure/guards/jwt-auth.guard.js";
import { RolesGuard } from "../../../identity/infrastructure/guards/roles.guard.js";
import { Roles } from "../../../identity/infrastructure/decorators/roles.decorator.js";
import { AddBarcodeUseCase } from "../../application/use-cases/add-barcode.use-case.js";
import { CreateProductUseCase } from "../../application/use-cases/create-product.use-case.js";
import { FindProductByBarcodeUseCase } from "../../application/use-cases/find-product-by-barcode.use-case.js";
import { GetProductUseCase } from "../../application/use-cases/get-product.use-case.js";
import { ResolvePriceUseCase } from "../../application/use-cases/resolve-price.use-case.js";
import { ResolvePricesUseCase } from "../../application/use-cases/resolve-prices.use-case.js";
import { SearchProductsUseCase } from "../../application/use-cases/search-products.use-case.js";
import { UpdateProductUseCase } from "../../application/use-cases/update-product.use-case.js";
import { SyncProductsFromBlingUseCase } from "../../application/use-cases/sync-products-from-bling.use-case.js";
import { toProductResponseDto } from "../../application/dtos/product-response.dto.js";

/**
 * `?ids=a,b,c` (PERF-02) — no máximo 200 ids, cada um no formato de id. Sem
 * esse limite o parâmetro vira vetor de carga (um `IN` gigante no SQLite).
 */
const MAX_PRICE_BATCH = 200;
const resolvePricesQuerySchema = z.object({
  ids: z
    .string()
    .transform((raw) => raw.split(",").map((id) => id.trim()).filter((id) => id.length > 0))
    .pipe(z.array(z.string().regex(/^[A-Za-z0-9_-]{1,64}$/)).min(1).max(MAX_PRICE_BATCH)),
});
type ResolvePricesQuery = z.infer<typeof resolvePricesQuerySchema>;

@Controller("products")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(
    private readonly createProductUseCase: CreateProductUseCase,
    private readonly updateProductUseCase: UpdateProductUseCase,
    private readonly addBarcodeUseCase: AddBarcodeUseCase,
    private readonly findProductByBarcodeUseCase: FindProductByBarcodeUseCase,
    private readonly searchProductsUseCase: SearchProductsUseCase,
    private readonly resolvePriceUseCase: ResolvePriceUseCase,
    private readonly resolvePricesUseCase: ResolvePricesUseCase,
    private readonly getProductUseCase: GetProductUseCase,
    private readonly syncProductsFromBlingUseCase: SyncProductsFromBlingUseCase,
  ) {}

  @Get("search")
  async search(@Query("query") query = "", @Query("limit") limit?: string) {
    // Autocomplete da Venda usa o default (25); a tela Produtos pede mais.
    const parsed = Number.parseInt(limit ?? "", 10);
    const products = await this.searchProductsUseCase.execute(query, Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 20000) : undefined);
    return products.map(toProductResponseDto);
  }

  @Get("by-barcode/:code")
  async byBarcode(@Param("code") code: string) {
    const product = await this.findProductByBarcodeUseCase.execute(code);
    const price = await this.resolvePriceUseCase.execute(product.id);
    return { product: toProductResponseDto(product), price };
  }

  /** Declarada ANTES de `@Get(":id")` de propósito — senão "prices" cairia como id de produto. */
  @Get("prices")
  prices(@Query(new ZodValidationPipe(resolvePricesQuerySchema)) query: ResolvePricesQuery) {
    return this.resolvePricesUseCase.execute(query.ids);
  }

  @Get(":id/price")
  price(@Param("id") id: string) {
    return this.resolvePriceUseCase.execute(id);
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    const product = await this.getProductUseCase.execute(id);
    return toProductResponseDto(product);
  }

  @Post("sync-bling")
  @Roles("administrador", "gerente")
  syncBling() {
    return this.syncProductsFromBlingUseCase.execute();
  }

  @Post()
  @Roles("administrador", "gerente")
  async create(@Body(new ZodValidationPipe(createProductSchema)) body: CreateProductInput) {
    const product = await this.createProductUseCase.execute(body);
    return toProductResponseDto(product);
  }

  @Patch(":id")
  @Roles("administrador", "gerente")
  async update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateProductSchema)) body: UpdateProductInput,
  ) {
    const product = await this.updateProductUseCase.execute(id, body);
    return toProductResponseDto(product);
  }

  @Post(":id/barcodes")
  @Roles("administrador", "gerente")
  async addBarcode(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(addBarcodeSchema)) body: AddBarcodeInput,
  ) {
    await this.addBarcodeUseCase.execute(id, body);
    return { success: true };
  }
}
