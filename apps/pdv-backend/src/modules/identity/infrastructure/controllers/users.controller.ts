import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import {
  createUserSchema,
  resetPasswordSchema,
  updateUserRoleSchema,
  type CreateUserInput,
  type ResetPasswordInput,
  type UpdateUserRoleInput,
} from "@easypdv/shared-validation";
import { ZodValidationPipe } from "../../../../common/pipes/zod-validation.pipe.js";
import { CreateUserUseCase } from "../../application/use-cases/create-user.use-case.js";
import { ListUsersUseCase } from "../../application/use-cases/list-users.use-case.js";
import { UpdateUserRoleUseCase } from "../../application/use-cases/update-user-role.use-case.js";
import { ResetUserPasswordUseCase } from "../../application/use-cases/reset-user-password.use-case.js";
import { toUserResponseDto } from "../../application/dtos/user-response.dto.js";
import { CurrentUser, type AuthenticatedUser } from "../decorators/current-user.decorator.js";
import { JwtAuthGuard } from "../guards/jwt-auth.guard.js";
import { RolesGuard } from "../guards/roles.guard.js";
import { Roles } from "../decorators/roles.decorator.js";

@Controller("users")
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly listUsersUseCase: ListUsersUseCase,
    private readonly updateUserRoleUseCase: UpdateUserRoleUseCase,
    private readonly resetUserPasswordUseCase: ResetUserPasswordUseCase,
  ) {}

  @Get()
  @Roles("administrador")
  async list() {
    const users = await this.listUsersUseCase.execute();
    return users.map(toUserResponseDto);
  }

  @Post()
  @Roles("administrador")
  async create(@Body(new ZodValidationPipe(createUserSchema)) body: CreateUserInput) {
    const user = await this.createUserUseCase.execute(body);
    return toUserResponseDto(user);
  }

  @Patch(":id/role")
  @Roles("administrador")
  async updateRole(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateUserRoleSchema)) body: UpdateUserRoleInput,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const user = await this.updateUserRoleUseCase.execute(id, body.role, actor.userId);
    return toUserResponseDto(user);
  }

  /** Reset por admin (2026-08-21) — admin não precisa saber a senha atual; sempre força troca no próximo login (mustChangePassword). */
  @Patch(":id/reset-password")
  @Roles("administrador")
  async resetPassword(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(resetPasswordSchema)) body: ResetPasswordInput,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const user = await this.resetUserPasswordUseCase.execute(id, body.newPassword, actor.userId);
    return toUserResponseDto(user);
  }
}
