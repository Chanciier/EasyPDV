import { Controller, Get, Post, UseGuards } from "@nestjs/common";
import { OrgJwtAuthGuard } from "../../../organizations/infrastructure/guards/org-jwt-auth.guard.js";
import {
  CurrentOrgUser,
  type AuthenticatedOrgUser,
} from "../../../organizations/infrastructure/decorators/current-org-user.decorator.js";
import { WhatsappProvider } from "../../whatsapp.provider.js";

/**
 * Tela de pareamento do painel admin (Fase 4, 2026-09-14) — mesma fronteira
 * de confiança de `AdminClubController` (`OrgJwtAuthGuard`, nunca
 * `TerminalApiKeyGuard`: quem pergunta é o navegador do admin, não um
 * terminal). `organizationId` sempre do token, nunca da URL/corpo.
 */
@Controller("admin/whatsapp")
@UseGuards(OrgJwtAuthGuard)
export class AdminWhatsappController {
  constructor(private readonly whatsappProvider: WhatsappProvider) {}

  @Get("status")
  status(@CurrentOrgUser() user: AuthenticatedOrgUser) {
    return this.whatsappProvider.getStatus(user.organizationId);
  }

  @Post("logout")
  async logout(@CurrentOrgUser() user: AuthenticatedOrgUser) {
    await this.whatsappProvider.logout(user.organizationId);
    return { success: true };
  }
}
