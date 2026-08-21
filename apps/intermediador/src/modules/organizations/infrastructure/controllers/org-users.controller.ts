import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  createUserSchema,
  loginSchema,
  updateOrgUserSchema,
  type CreateUserInput,
  type LoginInput,
  type UpdateOrgUserInput,
} from "@easypdv/shared-validation";
import type { OrgUserPayload } from "@easypdv/shared-types";
import { ZodValidationPipe } from "../../../../common/pipes/zod-validation.pipe.js";
import { OrganizationMismatchError } from "../../domain/errors.js";
import type { OrgUser } from "../../domain/entities/org-user.entity.js";
import { CreateOrgUserUseCase } from "../../application/use-cases/create-org-user.use-case.js";
import { ListOrgUsersUseCase } from "../../application/use-cases/list-org-users.use-case.js";
import { UpdateOrgUserUseCase } from "../../application/use-cases/update-org-user.use-case.js";
import { VerifyOrgUserLoginUseCase } from "../../application/use-cases/verify-org-user-login.use-case.js";
import { TerminalApiKeyGuard } from "../guards/terminal-api-key.guard.js";
import { VerifyLoginThrottlerGuard } from "../guards/verify-login-throttler.guard.js";
import { CurrentTerminal, type AuthenticatedTerminal } from "../decorators/current-terminal.decorator.js";

function toOrgUserPayload(user: OrgUser): OrgUserPayload {
  return {
    id: user.id,
    organizationId: user.organizationId,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
    employeeCode: user.employeeCode,
  };
}

/**
 * Usuário canônico por organização (login único entre terminais, 2026-08-21)
 * — ver docs/DATABASE.md `OrgUser`. Todas as rotas exigem `TerminalApiKeyGuard`
 * (quem pergunta é sempre um terminal já ativado) e conferem que o terminal
 * pertence de fato à organização do path — mesmo padrão de
 * `OrganizationsController.generateActivationCode`.
 */
@Controller("organizations/:organizationId/users")
@UseGuards(TerminalApiKeyGuard)
export class OrgUsersController {
  constructor(
    private readonly createOrgUserUseCase: CreateOrgUserUseCase,
    private readonly listOrgUsersUseCase: ListOrgUsersUseCase,
    private readonly updateOrgUserUseCase: UpdateOrgUserUseCase,
    private readonly verifyOrgUserLoginUseCase: VerifyOrgUserLoginUseCase,
  ) {}

  private assertOwnsOrganization(organizationId: string, terminal: AuthenticatedTerminal): void {
    if (terminal.organizationId !== organizationId) {
      throw new OrganizationMismatchError();
    }
  }

  @Post()
  async create(
    @Param("organizationId") organizationId: string,
    @Body(new ZodValidationPipe(createUserSchema)) body: CreateUserInput,
    @CurrentTerminal() terminal: AuthenticatedTerminal,
  ): Promise<OrgUserPayload> {
    this.assertOwnsOrganization(organizationId, terminal);
    const user = await this.createOrgUserUseCase.execute(organizationId, body);
    return toOrgUserPayload(user);
  }

  @Get()
  async list(
    @Param("organizationId") organizationId: string,
    @CurrentTerminal() terminal: AuthenticatedTerminal,
  ): Promise<OrgUserPayload[]> {
    this.assertOwnsOrganization(organizationId, terminal);
    const users = await this.listOrgUsersUseCase.execute(organizationId);
    return users.map(toOrgUserPayload);
  }

  @Patch(":userId")
  async update(
    @Param("organizationId") organizationId: string,
    @Param("userId") userId: string,
    @Body(new ZodValidationPipe(updateOrgUserSchema)) body: UpdateOrgUserInput,
    @CurrentTerminal() terminal: AuthenticatedTerminal,
  ): Promise<OrgUserPayload> {
    this.assertOwnsOrganization(organizationId, terminal);
    const user = await this.updateOrgUserUseCase.execute(userId, body);
    return toOrgUserPayload(user);
  }

  /**
   * `VerifyLoginThrottlerGuard` depois do `TerminalApiKeyGuard` de propósito
   * (ordem do array) — precisa de `request.terminal` já resolvido pra
   * conseguir chavear o limite por terminal+e-mail, não só por IP.
   */
  @Post("verify-login")
  @UseGuards(VerifyLoginThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async verifyLogin(
    @Param("organizationId") organizationId: string,
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @CurrentTerminal() terminal: AuthenticatedTerminal,
  ): Promise<OrgUserPayload> {
    this.assertOwnsOrganization(organizationId, terminal);
    const user = await this.verifyOrgUserLoginUseCase.execute(organizationId, body.email, body.password);
    return toOrgUserPayload(user);
  }
}
