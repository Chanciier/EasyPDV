import { Body, Controller, Param, Post } from "@nestjs/common";
import {
  createOrganizationSchema,
  generateActivationCodeSchema,
  type CreateOrganizationInput,
  type GenerateActivationCodeInput,
} from "@easypdv/shared-validation";
import { ZodValidationPipe } from "../../../../common/pipes/zod-validation.pipe.js";
import { CreateOrganizationUseCase } from "../../application/use-cases/create-organization.use-case.js";
import { GenerateActivationCodeUseCase } from "../../application/use-cases/generate-activation-code.use-case.js";

/**
 * Sem autenticação por enquanto (bootstrapping/administração de tenant —
 * mesmo risco já documentado desde a Sprint 6, ver docs/ERROR-HANDLING.md).
 * Sem UI de admin ainda: uso via curl/Postman por quem está provisionando
 * um cliente novo do EasyPDV.
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
  generateActivationCode(
    @Param("id") organizationId: string,
    @Body(new ZodValidationPipe(generateActivationCodeSchema)) body: GenerateActivationCodeInput,
  ) {
    return this.generateActivationCodeUseCase.execute(organizationId, body);
  }
}
