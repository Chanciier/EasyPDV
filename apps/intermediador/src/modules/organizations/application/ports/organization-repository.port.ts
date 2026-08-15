import type { Organization } from "../../domain/entities/organization.entity.js";

export interface CreateOrganizationData {
  name: string;
  document: string | null;
}

export interface OrganizationRepositoryPort {
  create(data: CreateOrganizationData): Promise<Organization>;
  findById(id: string): Promise<Organization | null>;
}

export const ORGANIZATION_REPOSITORY = Symbol("ORGANIZATION_REPOSITORY");
