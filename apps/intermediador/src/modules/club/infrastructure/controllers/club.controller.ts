import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { addClubMemberSchema, type AddClubMemberInput } from "@easypdv/shared-validation";
import { ZodValidationPipe } from "../../../../common/pipes/zod-validation.pipe.js";
import { TerminalApiKeyGuard } from "../../../organizations/infrastructure/guards/terminal-api-key.guard.js";
import {
  CurrentTerminal,
  type AuthenticatedTerminal,
} from "../../../organizations/infrastructure/decorators/current-terminal.decorator.js";
import { CheckClubMembershipUseCase } from "../../application/use-cases/check-club-membership.use-case.js";
import { ListClubMembersUseCase } from "../../application/use-cases/list-club-members.use-case.js";
import { AddClubMemberUseCase } from "../../application/use-cases/add-club-member.use-case.js";
import { RemoveClubMemberUseCase } from "../../application/use-cases/remove-club-member.use-case.js";

/**
 * Chamado pelo PDV local (não uma tela de admin) — mesma fronteira de
 * confiança de /fiscal e /sync (ver docblocks lá). Escopado sempre pela
 * organização do terminal autenticado, nunca aceita organizationId no corpo.
 */
@Controller("club")
@UseGuards(TerminalApiKeyGuard)
export class ClubController {
  constructor(
    private readonly checkClubMembershipUseCase: CheckClubMembershipUseCase,
    private readonly listClubMembersUseCase: ListClubMembersUseCase,
    private readonly addClubMemberUseCase: AddClubMemberUseCase,
    private readonly removeClubMemberUseCase: RemoveClubMemberUseCase,
  ) {}

  @Get("status/:document")
  async status(@Param("document") document: string, @CurrentTerminal() terminal: AuthenticatedTerminal) {
    const isMember = await this.checkClubMembershipUseCase.execute(terminal.organizationId, document);
    return { isMember };
  }

  @Get("members")
  list(@CurrentTerminal() terminal: AuthenticatedTerminal) {
    return this.listClubMembersUseCase.execute(terminal.organizationId);
  }

  @Post("members")
  add(
    @Body(new ZodValidationPipe(addClubMemberSchema)) body: AddClubMemberInput,
    @CurrentTerminal() terminal: AuthenticatedTerminal,
  ) {
    return this.addClubMemberUseCase.execute(terminal.organizationId, body.name, body.document, body.validUntil, body.phone);
  }

  @Delete("members/:document")
  async remove(@Param("document") document: string, @CurrentTerminal() terminal: AuthenticatedTerminal) {
    await this.removeClubMemberUseCase.execute(terminal.organizationId, document);
    return { removed: true };
  }
}
