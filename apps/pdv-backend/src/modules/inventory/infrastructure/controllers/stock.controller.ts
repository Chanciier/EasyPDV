import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { registerStockMovementSchema, type RegisterStockMovementInput } from "@easypdv/shared-validation";
import { ZodValidationPipe } from "../../../../common/pipes/zod-validation.pipe.js";
import { CurrentUser, type AuthenticatedUser } from "../../../identity/infrastructure/decorators/current-user.decorator.js";
import { JwtAuthGuard } from "../../../identity/infrastructure/guards/jwt-auth.guard.js";
import { RolesGuard } from "../../../identity/infrastructure/guards/roles.guard.js";
import { Roles } from "../../../identity/infrastructure/decorators/roles.decorator.js";
import { GetStockUseCase } from "../../application/use-cases/get-stock.use-case.js";
import { ListStockUseCase } from "../../application/use-cases/list-stock.use-case.js";
import { ListStockMovementsUseCase } from "../../application/use-cases/list-stock-movements.use-case.js";
import { RegisterStockMovementUseCase } from "../../application/use-cases/register-stock-movement.use-case.js";

@Controller("stock")
@UseGuards(JwtAuthGuard, RolesGuard)
export class StockController {
  constructor(
    private readonly getStockUseCase: GetStockUseCase,
    private readonly listStockUseCase: ListStockUseCase,
    private readonly listStockMovementsUseCase: ListStockMovementsUseCase,
    private readonly registerStockMovementUseCase: RegisterStockMovementUseCase,
  ) {}

  /**
   * Estoque de todo o catálogo num tiro só, pra tela Produtos mostrar uma
   * coluna "Estoque" sem uma chamada por produto (2026-08-19). Precisa vir
   * ANTES de `:warehouseId/:productId` no arquivo — Nest resolve rotas por
   * ordem de declaração, e um literal genérico feito de dois segmentos
   * casaria com `/stock/summary` "de qualquer jeito" só por acidente de
   * nome, então mantém como rota de zero segmentos mesmo (`GET /stock`).
   */
  @Get()
  listAll() {
    return this.listStockUseCase.execute();
  }

  @Get("movements")
  listMovements(@Query("warehouseId") warehouseId?: string, @Query("productId") productId?: string) {
    return this.listStockMovementsUseCase.execute({ warehouseId, productId });
  }

  @Post("movements")
  @Roles("administrador", "gerente", "supervisor")
  registerMovement(
    @Body(new ZodValidationPipe(registerStockMovementSchema)) body: RegisterStockMovementInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.registerStockMovementUseCase.execute(body, user.userId);
  }

  @Get(":warehouseId/:productId")
  getStock(@Param("warehouseId") warehouseId: string, @Param("productId") productId: string) {
    return this.getStockUseCase.execute(warehouseId, productId);
  }
}
