import { Inject, Injectable } from "@nestjs/common";
import { CUSTOMER_REPOSITORY, type CustomerRepositoryPort } from "../../../customers/application/ports/customer-repository.port.js";
import { ListClubMembersUseCase } from "./list-club-members.use-case.js";
import type { ClubMemberAdminSummary } from "../../domain/entities/club-member-summary.js";

/**
 * `GET /admin/club/members` (painel admin, Fase 2 do lembrete de renovação,
 * 2026-09-14) — mesma lista de `ListClubMembersUseCase` (Bling é a fonte de
 * "é do clube"), enriquecida com telefone/consentimento do `Customer`
 * central. Uma busca em lote por documento (PERF-15); base de sócios
 * pequena (21+ registros), sem paginação necessária.
 */
@Injectable()
export class ListClubMembersForAdminUseCase {
  constructor(
    private readonly listClubMembersUseCase: ListClubMembersUseCase,
    @Inject(CUSTOMER_REPOSITORY) private readonly customerRepository: CustomerRepositoryPort,
  ) {}

  async execute(organizationId: string): Promise<ClubMemberAdminSummary[]> {
    const members = await this.listClubMembersUseCase.execute(organizationId);
    // PERF-15 (2026-10-22): uma query para todos os documentos em vez de uma
    // por sócio — mesma resposta.
    const customers = await this.customerRepository.findManyByDocuments(organizationId, [
      ...new Set(members.map((member) => member.document)),
    ]);
    const customerByDocument = new Map(customers.map((c) => [c.document, c]));
    const summaries: ClubMemberAdminSummary[] = [];
    for (const member of members) {
      const customer = customerByDocument.get(member.document);
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
