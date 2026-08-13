import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { UserRole } from "@easypdv/shared-types";
import { ROLES_KEY } from "../decorators/roles.decorator.js";

/**
 * Policy de autorização (RBAC) — decide "quem pode", diferente de uma
 * Specification que decide "o que é estruturalmente válido". Ver docs/CODING-STANDARDS.md.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userRole: UserRole | undefined = request.user?.role;
    if (!userRole || !requiredRoles.includes(userRole)) {
      throw new ForbiddenException("Papel do usuário não autoriza esta ação");
    }
    return true;
  }
}
