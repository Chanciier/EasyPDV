import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { UserRole } from "@easypdv/shared-types";
import { ROLES_KEY } from "../decorators/roles.decorator.js";

/**
 * Policy de autorização (RBAC) — decide "quem pode", diferente de uma
 * Specification que decide "o que é estruturalmente válido". Ver docs/CODING-STANDARDS.md.
 *
 * Achado real (2026-09-16): "proprietario" — o papel mais alto que existe
 * (`UserRole`, shared-types) — não aparecia em NENHUM `@Roles(...)` do
 * pdv-backend, exceto `ReportsController`. Todo outro controller restrito
 * (Clientes, Vale-Troca, Estoque, Produtos, Usuários, Cancelar venda, Caixa,
 * Sincronização...) lista só `"administrador"`/`"gerente"` — o dono da loja
 * ficava sem acesso a quase tudo que exige papel elevado, mesmo sendo o
 * papel mais alto. Corrigido aqui, num lugar só, em vez de adicionar
 * "proprietario" em cada `@Roles(...)` espalhado pelo código (mais fácil de
 * manter, e não depende de lembrar disso em cada controller novo).
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
    if (userRole === "proprietario") {
      return true;
    }
    if (!userRole || !requiredRoles.includes(userRole)) {
      throw new ForbiddenException("Papel do usuário não autoriza esta ação");
    }
    return true;
  }
}
