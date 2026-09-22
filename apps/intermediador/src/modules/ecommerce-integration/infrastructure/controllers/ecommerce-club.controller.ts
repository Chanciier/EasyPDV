import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { addClubMemberSchema, type AddClubMemberInput } from "@easypdv/shared-validation";
import { ZodValidationPipe } from "../../../../common/pipes/zod-validation.pipe.js";
import { AddClubMemberUseCase } from "../../../club/application/use-cases/add-club-member.use-case.js";
import { EcommerceApiKeyGuard } from "../guards/ecommerce-api-key.guard.js";

/**
 * Chamado pelo backend do e-commerce (Sald-o-da-Reserva) depois que o
 * pagamento do "Clube Reversa" é aprovado — mesmo clube/tag do Bling
 * usado pela loja física ("Clube Saldão"), só um caller diferente.
 * Reaproveita AddClubMemberUseCase (mesma lógica de achar/criar contato no
 * Bling, marcar a tag e validade) — nenhuma lógica de Bling nova aqui.
 */
@Controller("integrations/ecommerce")
@UseGuards(EcommerceApiKeyGuard)
export class EcommerceClubController {
  constructor(
    private readonly config: ConfigService,
    private readonly addClubMemberUseCase: AddClubMemberUseCase,
  ) {}

  @Post("club-members")
  add(@Body(new ZodValidationPipe(addClubMemberSchema)) body: AddClubMemberInput) {
    const organizationId = this.config.getOrThrow<string>("ECOMMERCE_ORGANIZATION_ID");
    return this.addClubMemberUseCase.execute(
      organizationId,
      body.name,
      body.document,
      body.validUntil,
      body.phone,
      body.whatsappConsent,
    );
  }
}
