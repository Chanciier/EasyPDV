import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { loginSchema, refreshTokenSchema, type LoginInput, type RefreshTokenInput } from "@easypdv/shared-validation";
import { ZodValidationPipe } from "../../../../common/pipes/zod-validation.pipe.js";
import { OrgUserOrganizationMismatchError } from "../../domain/errors.js";
import { OrgLoginUseCase } from "../../application/use-cases/org-login.use-case.js";
import { OrgRefreshTokenUseCase } from "../../application/use-cases/org-refresh-token.use-case.js";
import { OrgLogoutUseCase } from "../../application/use-cases/org-logout.use-case.js";
import { GetCurrentOrgUserUseCase } from "../../application/use-cases/get-current-org-user.use-case.js";
import { OrgJwtAuthGuard } from "../guards/org-jwt-auth.guard.js";
import { OrgLoginThrottlerGuard } from "../guards/org-login-throttler.guard.js";
import { CurrentOrgUser, type AuthenticatedOrgUser } from "../decorators/current-org-user.decorator.js";

/**
 * Login direto no Intermediador (Fase 0 do painel administrativo,
 * 2026-09-10) — fecha o risco #9 (Decisões e Riscos Abertos, cofre
 * Obsidian): antes desta rota, não existia autenticação de administrador
 * nenhuma, só a mediada por terminal (`OrgUsersController.verifyLogin`).
 *
 * `organizationId` no path em toda rota, mesmo padrão de OrgUsersController
 * — email é único só POR organização (@@unique([organizationId, email])),
 * então login precisa saber em qual organização procurar.
 */
@Controller("organizations/:organizationId/auth")
export class OrgAuthController {
  constructor(
    private readonly orgLoginUseCase: OrgLoginUseCase,
    private readonly orgRefreshTokenUseCase: OrgRefreshTokenUseCase,
    private readonly orgLogoutUseCase: OrgLogoutUseCase,
    private readonly getCurrentOrgUserUseCase: GetCurrentOrgUserUseCase,
  ) {}

  @Post("login")
  @UseGuards(OrgLoginThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  login(
    @Param("organizationId") organizationId: string,
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
  ) {
    return this.orgLoginUseCase.execute(organizationId, body.email, body.password);
  }

  @Post("refresh")
  refresh(@Body(new ZodValidationPipe(refreshTokenSchema)) body: RefreshTokenInput) {
    return this.orgRefreshTokenUseCase.execute(body.refreshToken);
  }

  @Post("logout")
  async logout(@Body(new ZodValidationPipe(refreshTokenSchema)) body: RefreshTokenInput) {
    await this.orgLogoutUseCase.execute(body.refreshToken);
    return { success: true };
  }

  @UseGuards(OrgJwtAuthGuard)
  @Get("me")
  async me(@Param("organizationId") organizationId: string, @CurrentOrgUser() currentUser: AuthenticatedOrgUser) {
    if (currentUser.organizationId !== organizationId) {
      throw new OrgUserOrganizationMismatchError();
    }
    return this.getCurrentOrgUserUseCase.execute(currentUser.orgUserId);
  }
}
