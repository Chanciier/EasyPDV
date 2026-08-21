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
}

export const ORG_USER_REPOSITORY = Symbol("ORG_USER_REPOSITORY");
