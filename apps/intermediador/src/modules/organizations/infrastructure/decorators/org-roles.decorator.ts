import { SetMetadata } from "@nestjs/common";

export const ORG_ROLES_KEY = "orgRoles";

/**
 * SEG-06 (2026-10-22): papéis do `OrgUser` (claim `role` do JWT do painel)
 * autorizados numa rota admin. `proprietario` sempre passa — ver
 * OrgRolesGuard. Usar junto de `@UseGuards(OrgJwtAuthGuard, OrgRolesGuard)`.
 */
export const OrgRoles = (...roles: string[]) => SetMetadata(ORG_ROLES_KEY, roles);
