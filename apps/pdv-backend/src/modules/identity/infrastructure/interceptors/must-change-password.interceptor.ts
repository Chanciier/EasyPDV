import { CallHandler, ExecutionContext, ForbiddenException, Injectable, NestInterceptor } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Observable } from "rxjs";
import { SKIP_MUST_CHANGE_PASSWORD_KEY } from "../decorators/skip-must-change-password.decorator.js";
import type { AuthenticatedUser } from "../decorators/current-user.decorator.js";

/**
 * Achado C6 da auditoria de segurança (2026-09-14, cofre Obsidian "Auditoria
 * de Segurança Completa — EasyPDV"): `mustChangePassword` (ver
 * `ensureAdminUser` em main.ts) só bloqueava o resto do app na TELA
 * (`ForceChangePasswordScreen`, frontend) — chamando a API direto (curl,
 * Postman), a conta admin de fallback (senha pública, documentada no próprio
 * repositório) continuava 100% funcional indefinidamente. Este interceptor
 * fecha isso no backend: registrado global (`APP_INTERCEPTOR`, ver
 * IdentityModule) porque `JwtAuthGuard` é usado em todo controller sensível
 * do app sem estar registrado em nenhum módulo central — um guard global
 * teria a mesma ordem de execução que os guards por rota (não garante rodar
 * DEPOIS do JwtAuthGuard, que é quem popula `request.user`), mas
 * interceptors globais sempre rodam depois de TODOS os guards no ciclo de
 * vida do Nest, então este funciona sem precisar tocar em nenhum outro
 * controller.
 */
@Injectable()
export class MustChangePasswordInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    // Sem `user`: rota pública (login, health, etc.) ou nenhum JwtAuthGuard
    // rodou antes — nada a fazer aqui, não é responsabilidade deste
    // interceptor decidir se a rota exige autenticação.
    if (!user) {
      return next.handle();
    }

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_MUST_CHANGE_PASSWORD_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!skip && user.mustChangePassword) {
      throw new ForbiddenException("Troca de senha obrigatória antes de continuar.");
    }

    return next.handle();
  }
}
