import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ORG_ROLES_KEY } from "../decorators/org-roles.decorator.js";

/** Papéis que operam o painel admin quando a rota não declara outros (decisão do plano de 2026-10-22). */
export const ADMIN_PANEL_ROLES = ["administrador", "gerente"] as const;

/**
 * SEG-06 (2026-10-22, risco #39): o `OrgJwtAuthGuard` só valida a assinatura
 * do JWT — qualquer `OrgUser` logado (até `operador`) usava as rotas do
 * painel: payload de venda com CPF, reenfileirar jobs, disparar lembrete de
 * WhatsApp, conectar outra conta Bling. Mesmo desenho do `RolesGuard` do
 * pdv-backend, com o mesmo bypass de `proprietario`. Fail-closed de
 * propósito: rota sem `@OrgRoles` usa `ADMIN_PANEL_ROLES` em vez de liberar,
 * porque este guard só é aplicado em rota de painel. Só depende do
 * `Reflector` (global no Nest), então não precisa ser registrado nos
 * providers dos módulos consumidores. Lê o papel do claim — rebaixar alguém
 * vale a partir do próximo token (até 15 min).
 */
@Injectable()
export class OrgRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const declared = this.reflector.getAllAndOverride<string[] | undefined>(ORG_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const allowed: readonly string[] = declared && declared.length > 0 ? declared : ADMIN_PANEL_ROLES;

    const request = context.switchToHttp().getRequest<{ user?: { role?: string } }>();
    const role = request.user?.role;
    if (role === "proprietario") {
      return true;
    }
    if (!role || !allowed.includes(role)) {
      throw new ForbiddenException("Seu papel não tem acesso ao painel administrativo.");
    }
    return true;
  }
}
