import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { addClubMemberSchema, type AddClubMemberInput } from "@easypdv/shared-validation";
import { ZodValidationPipe } from "../../../../common/pipes/zod-validation.pipe.js";
import { AddClubMemberUseCase } from "../../../club/application/use-cases/add-club-member.use-case.js";
import { GetClubMembershipStatusUseCase } from "../../../club/application/use-cases/get-club-membership-status.use-case.js";
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
    private readonly getClubMembershipStatusUseCase: GetClubMembershipStatusUseCase,
  ) {}

  // Checagem antes de cobrar de novo — o site chama isso ao sair do campo
  // CPF pra avisar "você já é sócio até DD/MM" antes de ir pro pagamento.
  // Mesmo cache local (ClubMembership) usado pela venda no PDV, então cobre
  // sócio cadastrado tanto pela loja física quanto por uma assinatura
  // anterior do site.
  @Get("club-members/:document")
  status(@Param("document") document: string) {
    const organizationId = this.config.getOrThrow<string>("ECOMMERCE_ORGANIZATION_ID");
    return this.getClubMembershipStatusUseCase.execute(organizationId, document);
  }

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
