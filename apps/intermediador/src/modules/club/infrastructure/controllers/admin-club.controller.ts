import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { setWhatsappConsentSchema, type SetWhatsappConsentInput } from "@easypdv/shared-validation";
import { ZodValidationPipe } from "../../../../common/pipes/zod-validation.pipe.js";
import { OrgJwtAuthGuard } from "../../../organizations/infrastructure/guards/org-jwt-auth.guard.js";
import {
  CurrentOrgUser,
  type AuthenticatedOrgUser,
} from "../../../organizations/infrastructure/decorators/current-org-user.decorator.js";
import { ListClubMembersForAdminUseCase } from "../../application/use-cases/list-club-members-for-admin.use-case.js";
import { SetWhatsappConsentUseCase } from "../../../customers/application/use-cases/set-whatsapp-consent.use-case.js";

/**
 * Painel administrativo (Fase 2 do lembrete de renovação, 2026-09-14) —
 * chamado pelo navegador do admin (sessão de `OrgJwtAuthGuard`, ver Fase 0),
 * nunca por um terminal — fronteira de confiança diferente de `ClubController`
 * (TerminalApiKeyGuard), por isso um controller à parte em vez de misturar
 * guards no mesmo. `organizationId` sempre lido do token, nunca aceito na
 * URL/corpo (mesmo motivo de ClubController: nunca confiar no cliente pra
 * escopo multi-tenant).
 */
@Controller("admin/club")
@UseGuards(OrgJwtAuthGuard)
export class AdminClubController {
  constructor(
    private readonly listClubMembersForAdminUseCase: ListClubMembersForAdminUseCase,
    private readonly setWhatsappConsentUseCase: SetWhatsappConsentUseCase,
  ) {}

  @Get("members")
  list(@CurrentOrgUser() user: AuthenticatedOrgUser) {
    return this.listClubMembersForAdminUseCase.execute(user.organizationId);
  }

  @Patch("members/:document/whatsapp-consent")
  setConsent(
    @Param("document") document: string,
    @Body(new ZodValidationPipe(setWhatsappConsentSchema)) body: SetWhatsappConsentInput,
    @CurrentOrgUser() user: AuthenticatedOrgUser,
  ) {
    return this.setWhatsappConsentUseCase.execute(user.organizationId, document, body.consent);
  }
}
