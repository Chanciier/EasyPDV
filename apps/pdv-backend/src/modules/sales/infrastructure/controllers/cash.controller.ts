import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import {
  closeCashSessionSchema,
  createCashRegisterSchema,
  openCashSessionSchema,
  registerCashMovementSchema,
  type CloseCashSessionInput,
  type CreateCashRegisterInput,
  type OpenCashSessionInput,
  type RegisterCashMovementInput,
} from "@easypdv/shared-validation";
import { ZodValidationPipe } from "../../../../common/pipes/zod-validation.pipe.js";
import { CurrentUser, type AuthenticatedUser } from "../../../identity/infrastructure/decorators/current-user.decorator.js";
import { JwtAuthGuard } from "../../../identity/infrastructure/guards/jwt-auth.guard.js";
import { RolesGuard } from "../../../identity/infrastructure/guards/roles.guard.js";
import { Roles } from "../../../identity/infrastructure/decorators/roles.decorator.js";
import { RealtimeGateway } from "../../../realtime/realtime.gateway.js";
import { CreateCashRegisterUseCase } from "../../application/use-cases/create-cash-register.use-case.js";
import { ListCashRegistersUseCase } from "../../application/use-cases/list-cash-registers.use-case.js";
import { OpenCashSessionUseCase } from "../../application/use-cases/open-cash-session.use-case.js";
import { CloseCashSessionUseCase } from "../../application/use-cases/close-cash-session.use-case.js";
import { RegisterCashMovementUseCase } from "../../application/use-cases/register-cash-movement.use-case.js";
import { GetCurrentCashSessionUseCase } from "../../application/use-cases/get-current-cash-session.use-case.js";
import { GetCashSessionUseCase } from "../../application/use-cases/get-cash-session.use-case.js";
import { ListCashMovementsUseCase } from "../../application/use-cases/list-cash-movements.use-case.js";

@Controller("cash")
@UseGuards(JwtAuthGuard, RolesGuard)
export class CashController {
  constructor(
    private readonly createCashRegisterUseCase: CreateCashRegisterUseCase,
    private readonly listCashRegistersUseCase: ListCashRegistersUseCase,
    private readonly openCashSessionUseCase: OpenCashSessionUseCase,
    private readonly closeCashSessionUseCase: CloseCashSessionUseCase,
    private readonly registerCashMovementUseCase: RegisterCashMovementUseCase,
    private readonly getCurrentCashSessionUseCase: GetCurrentCashSessionUseCase,
    private readonly getCashSessionUseCase: GetCashSessionUseCase,
    private readonly listCashMovementsUseCase: ListCashMovementsUseCase,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  @Get("registers")
  listRegisters() {
    return this.listCashRegistersUseCase.execute();
  }

  @Post("registers")
  @Roles("administrador", "gerente")
  createRegister(@Body(new ZodValidationPipe(createCashRegisterSchema)) body: CreateCashRegisterInput) {
    return this.createCashRegisterUseCase.execute(body.name);
  }

  @Get("sessions/current")
  getCurrent(@CurrentUser() user: AuthenticatedUser) {
    return this.getCurrentCashSessionUseCase.execute(user.userId);
  }

  @Get("sessions/:id")
  getSession(@Param("id") id: string) {
    return this.getCashSessionUseCase.execute(id);
  }

  @Post("sessions")
  async openSession(
    @Body(new ZodValidationPipe(openCashSessionSchema)) body: OpenCashSessionInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const session = await this.openCashSessionUseCase.execute(body, user.userId);
    this.realtimeGateway.emitCashSessionOpened({
      sessionId: session.id,
      cashRegisterId: session.cashRegisterId,
    });
    return session;
  }

  @Patch("sessions/:id/close")
  async closeSession(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(closeCashSessionSchema)) body: CloseCashSessionInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const session = await this.closeCashSessionUseCase.execute(id, body.closingAmount, user.userId);
    this.realtimeGateway.emitCashSessionClosed({
      sessionId: session.id,
      cashRegisterId: session.cashRegisterId,
    });
    return session;
  }

  @Post("sessions/:id/movements")
  registerMovement(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(registerCashMovementSchema)) body: RegisterCashMovementInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.registerCashMovementUseCase.execute(id, body, user.userId);
  }

  @Get("sessions/:id/movements")
  listMovements(@Param("id") id: string) {
    return this.listCashMovementsUseCase.execute(id);
  }
}
