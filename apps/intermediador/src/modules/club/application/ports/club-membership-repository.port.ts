import type { ErpProviderCode } from "../../../erp-integration/domain/entities/erp-integration.entity.js";
import type { ClubMembership } from "../../domain/entities/club-membership.entity.js";

export interface UpsertClubMembershipData {
  organizationId: string;
  provider: ErpProviderCode;
  customerCpf: string;
  validUntil: Date;
}

export interface ClubMembershipRepositoryPort {
  findByCpf(organizationId: string, provider: ErpProviderCode, customerCpf: string): Promise<ClubMembership | null>;
  upsert(data: UpsertClubMembershipData): Promise<ClubMembership>;
  delete(organizationId: string, provider: ErpProviderCode, customerCpf: string): Promise<void>;
  deleteExpired(before: Date): Promise<number>;
  /**
   * `organizationId` opcional (2026-09-14) — o gatilho manual do painel
   * admin (`AdminClubRemindersController`) sempre escopa pela organização
   * de quem chamou (nunca deixa um admin disparar lembrete de outra
   * organização). Omitido = sem filtro, varre TODAS (uso original, pensado
   * pra um cron global único — hoje sem gatilho automático, ver
   * `SweepClubRemindersUseCase`).
   */
  findExpiringBetween(start: Date, end: Date, organizationId?: string): Promise<ClubMembership[]>;
}

export const CLUB_MEMBERSHIP_REPOSITORY = Symbol("CLUB_MEMBERSHIP_REPOSITORY");
