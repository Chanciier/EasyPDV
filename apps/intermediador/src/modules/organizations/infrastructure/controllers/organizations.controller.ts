import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import {
  createOrganizationSchema,
  generateActivationCodeSchema,
  type CreateOrganizationInput,
  type GenerateActivationCodeInput,
} from "@easypdv/shared-validation";
import { ZodValidationPipe } from "../../../../common/pipes/zod-validation.pipe.js";
import { CreateOrganizationUseCase } from "../../application/use-cases/create-organization.use-case.js";
import { GenerateActivationCodeUseCase } from "../../application/use-cases/generate-activation-code.use-case.js";
import { TerminalApiKeyGuard } from "../guards/terminal-api-key.guard.js";
import { CurrentTerminal, type AuthenticatedTerminal } from "../decorators/current-terminal.decorator.js";

/**
 * `POST /` (criar organização nova) continua sem autenticação — bootstrap
 * chicken-and-egg de um cliente novo do EasyPDV, uso interno meu via
 * curl/Postman, nunca chamado pela UI de um cliente (mesmo risco aceito desde
 * a Sprint 6, ver docs/ERROR-HANDLING.md). `POST /:id/activation-codes` já
 * ganhou `TerminalApiKeyGuard` — é chamado pela própria UI do PDV agora (tela
 * Administração), então precisa confirmar que o terminal autenticado pertence
 * de fato à organização pra qual está pedindo um código novo.
 */
@Controller("organizations")
export class OrganizationsController {
  constructor(
    private readonly createOrganizationUseCase: CreateOrganizationUseCase,
    private readonly generateActivationCodeUseCase: GenerateActivationCodeUseCase,
  ) {}

  @Post()
  create(@Body(new ZodValidationPipe(createOrganizationSchema)) body: CreateOrganizationInput) {
    return this.createOrganizationUseCase.execute(body);
  }

  @Post(":id/activation-codes")
  @UseGuards(TerminalApiKeyGuard)
  generateActivationCode(
    @Param("id") organizationId: string,
    @Body(new ZodValidationPipe(generateActivationCodeSchema)) body: GenerateActivationCodeInput,
    @CurrentTerminal() terminal: AuthenticatedTerminal,
  ) {
    return this.generateActivationCodeUseCase.execute(organizationId, body, terminal.organizationId);
  }
}
