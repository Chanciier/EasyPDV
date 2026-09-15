import type { UserRole } from "@easypdv/shared-types";
import type { OrgUser } from "../../domain/entities/org-user.entity.js";

export interface CreateOrgUserData {
  organizationId: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  employeeCode: number;
}

export interface UpdateOrgUserData {
  role?: UserRole;
  active?: boolean;
  /** Bloqueio de conta por tentativa (2026-09-14) — ver VerifyOrgUserLoginUseCase. */
  failedLoginAttempts?: number;
  lockedUntil?: Date | null;
}

/** Porta — implementação concreta fica em infrastructure/repositories. */
export interface OrgUserRepositoryPort {
  findById(id: string): Promise<OrgUser | null>;
  findByOrganizationAndEmail(organizationId: string, email: string): Promise<OrgUser | null>;
  findAllByOrganization(organizationId: string): Promise<OrgUser[]>;
  create(data: CreateOrgUserData): Promise<OrgUser>;
  update(id: string, data: UpdateOrgUserData): Promise<OrgUser>;
  /** 0 se ainda não existe nenhum usuário nesta organização — CreateOrgUserUseCase soma 1 pra próxima matrícula. */
  getMaxEmployeeCode(organizationId: string): Promise<number>;
  /** Troca/reset de senha (2026-08-21) — método dedicado, separado do `update({role, active})` genérico porque senha é sensível demais pra ficar num DTO genérico. */
  updatePassword(id: string, passwordHash: string): Promise<OrgUser>;

  /**
   * Achados C4/C5 da auditoria de segurança (2026-09-14, cofre Obsidian
   * "Auditoria de Segurança Completa — EasyPDV") — variantes escopadas por
   * organização de `findById`/`update`/`updatePassword`, usadas só pelas
   * mutações que recebem `id` de fora (path param de
   * `PATCH /organizations/:organizationId/users/:userId[/password]`).
   * `findById`/`update`/`updatePassword` "sem organização" continuam
   * existindo pros outros dois usos (OrgRefreshTokenUseCase,
   * GetCurrentOrgUserUseCase, VerifyOrgUserLoginUseCase) — todos resolvem o
   * `id` de uma fonte já confiável (sessão validada, ou um `OrgUser` já
   * achado via `findByOrganizationAndEmail`), sem `organizationId` externo
   * pra comparar, então não têm o mesmo risco de IDOR.
   */
  findByIdInOrganization(organizationId: string, id: string): Promise<OrgUser | null>;
  updateInOrganization(organizationId: string, id: string, data: UpdateOrgUserData): Promise<OrgUser>;
  updatePasswordInOrganization(organizationId: string, id: string, passwordHash: string): Promise<OrgUser>;
}

export const ORG_USER_REPOSITORY = Symbol("ORG_USER_REPOSITORY");
