import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { addClubMemberSchema, type AddClubMemberInput } from "@easypdv/shared-validation";
import { ZodValidationPipe } from "../../../../common/pipes/zod-validation.pipe.js";
import { JwtAuthGuard } from "../../../identity/infrastructure/guards/jwt-auth.guard.js";
import { CurrentUser, type AuthenticatedUser } from "../../../identity/infrastructure/decorators/current-user.decorator.js";
import { CheckClubStatusUseCase } from "../../application/use-cases/check-club-status.use-case.js";
import { ListClubMembersUseCase } from "../../application/use-cases/list-club-members.use-case.js";
import { AddClubMemberUseCase } from "../../application/use-cases/add-club-member.use-case.js";
import { RemoveClubMemberUseCase } from "../../application/use-cases/remove-club-member.use-case.js";

/** Sem RolesGuard de propósito — visível/usável por todo operador de caixa, mesmo padrão de "Clientes". */
@Controller("club")
@UseGuards(JwtAuthGuard)
export class ClubController {
  constructor(
    private readonly checkClubStatusUseCase: CheckClubStatusUseCase,
    private readonly listClubMembersUseCase: ListClubMembersUseCase,
    private readonly addClubMemberUseCase: AddClubMemberUseCase,
    private readonly removeClubMemberUseCase: RemoveClubMemberUseCase,
  ) {}

  @Get("status/:document")
  async status(@Param("document") document: string) {
    const isMember = await this.checkClubStatusUseCase.execute(document);
    return { isMember };
  }

  @Get("members")
  list() {
    return this.listClubMembersUseCase.execute();
  }

  @Post("members")
  add(@Body(new ZodValidationPipe(addClubMemberSchema)) body: AddClubMemberInput, @CurrentUser() user: AuthenticatedUser) {
    return this.addClubMemberUseCase.execute(body, user.userId);
  }

  @Delete("members/:document")
  async remove(@Param("document") document: string, @CurrentUser() user: AuthenticatedUser) {
    await this.removeClubMemberUseCase.execute(document, user.userId);
    return { removed: true };
  }
}
