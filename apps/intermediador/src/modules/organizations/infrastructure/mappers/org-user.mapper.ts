import type { OrgUser as PrismaOrgUser } from "../../../../generated/prisma/index.js";
import { OrgUser } from "../../domain/entities/org-user.entity.js";

export function toDomainOrgUser(record: PrismaOrgUser): OrgUser {
  return new OrgUser({
    id: record.id,
    organizationId: record.organizationId,
    name: record.name,
    email: record.email,
    passwordHash: record.passwordHash,
    role: record.role,
    active: record.active,
    employeeCode: record.employeeCode,
  });
}
