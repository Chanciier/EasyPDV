import { SetMetadata } from "@nestjs/common";
import type { UserRole } from "@easypdv/shared-types";

export const ROLES_KEY = "roles";

/** Decora um handler/controller com os papéis autorizados. Ver RolesGuard. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
