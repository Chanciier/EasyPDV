import { Inject, Injectable } from "@nestjs/common";
import { CUSTOMER_REPOSITORY, type CustomerRepositoryPort } from "../../../customers/application/ports/customer-repository.port.js";
import { ListClubMembersUseCase } from "./list-club-members.use-case.js";
import type { ClubMemberAdminSummary } from "../../domain/entities/club-member-summary.js";

/**
 * `GET /admin/club/members` (painel admin, Fase 2 do lembrete de renovação,
 * 2026-09-14) — mesma lista de `ListClubMembersUseCase` (Bling é a fonte de
 * "é do clube"), enriquecida com telefone/consentimento do `Customer`
 * central. N buscas por documento (uma por sócio) — mesmo custo aceitável
 * de `listClubMembers` já ter N chamadas ao Bling; base de sócios pequena
 * (21+ registros), sem paginação necessária.
 */
@Injectable()
export class ListClubMembersForAdminUseCase {
  constructor(
    private readonly listClubMembersUseCase: ListClubMembersUseCase,
    @Inject(CUSTOMER_REPOSITORY) private readonly customerRepository: CustomerRepositoryPort,
  ) {}

  async execute(organizationId: string): Promise<ClubMemberAdminSummary[]> {
    const members = await this.listClubMembersUseCase.execute(organizationId);
    const summaries: ClubMemberAdminSummary[] = [];
    for (const member of members) {
      const customer = await this.customerRepository.findByDocument(organizationId, member.document);
      summaries.push({
        ...member,
        phone: customer?.phone ?? null,
        whatsappConsentAt: customer?.whatsappConsentAt?.toISOString() ?? null,
        whatsappOptOutAt: customer?.whatsappOptOutAt?.toISOString() ?? null,
      });
    }
    return summaries;
  }
}
