import type { OrgUserPayload } from "@easypdv/shared-types";
import type { OrgUser } from "../../domain/entities/org-user.entity.js";

/**
 * Domínio → payload de fio (nunca inclui passwordHash). Extraído de
 * `OrgUsersController` (2026-09-10) pra ser reaproveitado também pelas
 * novas use cases de sessão de admin (`OrgLoginUseCase` etc.), sem duplicar.
 */
export function toOrgUserPayload(user: OrgUser): OrgUserPayload {
  return {
    id: user.id,
    organizationId: user.organizationId,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
    employeeCode: user.employeeCode,
  };
}
