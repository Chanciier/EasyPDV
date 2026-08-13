import { Body, Controller, Get, Post, UseGuards, UsePipes } from "@nestjs/common";
import { loginSchema, refreshTokenSchema, type LoginInput, type RefreshTokenInput } from "@easypdv/shared-validation";
import { ZodValidationPipe } from "../../../../common/pipes/zod-validation.pipe.js";
import { LoginUseCase } from "../../application/use-cases/login.use-case.js";
import { LogoutUseCase } from "../../application/use-cases/logout.use-case.js";
import { RefreshTokenUseCase } from "../../application/use-cases/refresh-token.use-case.js";
import { GetCurrentUserUseCase } from "../../application/use-cases/get-current-user.use-case.js";
import { toUserResponseDto } from "../../application/dtos/user-response.dto.js";
import { CurrentUser, type AuthenticatedUser } from "../decorators/current-user.decorator.js";
import { JwtAuthGuard } from "../guards/jwt-auth.guard.js";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly getCurrentUserUseCase: GetCurrentUserUseCase,
  ) {}

  @Post("login")
  @UsePipes(new ZodValidationPipe(loginSchema))
  login(@Body() body: LoginInput) {
    return this.loginUseCase.execute(body);
  }

  @Post("refresh")
  @UsePipes(new ZodValidationPipe(refreshTokenSchema))
  refresh(@Body() body: RefreshTokenInput) {
    return this.refreshTokenUseCase.execute(body.refreshToken);
  }

  @Post("logout")
  @UsePipes(new ZodValidationPipe(refreshTokenSchema))
  async logout(@Body() body: RefreshTokenInput) {
    await this.logoutUseCase.execute(body.refreshToken);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  async me(@CurrentUser() currentUser: AuthenticatedUser) {
    const user = await this.getCurrentUserUseCase.execute(currentUser.userId);
    return toUserResponseDto(user);
  }
}
