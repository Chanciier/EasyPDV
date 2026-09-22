import { Inject, Injectable } from "@nestjs/common";
import type { ErpProviderCode } from "../../../erp-integration/domain/entities/erp-integration.entity.js";
import {
  CLUB_MEMBERSHIP_REPOSITORY,
  type ClubMembershipRepositoryPort,
} from "../ports/club-membership-repository.port.js";

const PROVIDER: ErpProviderCode = "bling";

export interface ClubMembershipStatus {
  isMember: boolean;
  validUntil: string | null;
}

/**
 * Status completo (com validade) por CPF, pra UI mostrar "você já é sócio
 * até DD/MM" — CheckClubMembershipUseCase já existia mas só devolve boolean
 * (uso na venda do PDV, sem UI pra exibir data). Mesma fonte de verdade
 * (cache local ClubMembership; nunca bate no Bling na hora do check — ver
 * docblock de BlingSyncTargetAdapter.checkClubMembership), então cobre
 * sócio cadastrado tanto pela loja física quanto pelo site.
 */
@Injectable()
export class GetClubMembershipStatusUseCase {
  constructor(
    @Inject(CLUB_MEMBERSHIP_REPOSITORY)
    private readonly clubMembershipRepository: ClubMembershipRepositoryPort,
  ) {}

  async execute(organizationId: string, document: string): Promise<ClubMembershipStatus> {
    const membership = await this.clubMembershipRepository.findByCpf(organizationId, PROVIDER, document);
    if (!membership || !membership.isValid) {
      return { isMember: false, validUntil: null };
    }
    return { isMember: true, validUntil: membership.validUntil.toISOString() };
  }
}
